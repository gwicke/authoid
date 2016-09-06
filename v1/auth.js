"use strict";

const HyperSwitch = require('hyperswitch');
const URI = HyperSwitch.URI;
const HTTPError = HyperSwitch.HTTPError;
const authLib = require('../sys/AuthLibrary');

const spec = HyperSwitch.utils.loadSpec(__dirname + '/auth.yaml');

const passwordTable = {
    name: 'auth_passwords',
    uri: '/wikimedia.org/sys/table/auth_passwords',
    entryURI: new URI(['wikimedia.org', 'sys', 'table', 'auth_passwords', '']),
    schema: {
        table: 'auth_passwords',
        version: 1,
        attributes: {
            userid: 'string',
            pass_hash: 'string',
            deleted: 'boolean',
        },
        index: [
            { attribute: 'userid', type: 'hash' },
        ],
        revisionRetentionPolicy: {
            type: 'latest',
            count: 1,
            grace_ttl: 0
        }
    }
};

const tokenTable = {
    name: 'auth_tokens',
    uri: '/wikimedia.org/sys/table/auth_tokens',
    entryURI: new URI(['wikimedia.org', 'sys', 'table', 'auth_tokens', '']),
    schema: {
        table: 'auth_tokens',
        version: 1,
        attributes: {
            userid: 'string',
            reset_token: 'string'
        },
        index: [
            { attribute: 'userid', type: 'hash' },
        ],
        revisionRetentionPolicy: {
            type: 'latest',
            count: 1,
            grace_ttl: 0
        }
    }
};


const tfaTable = {
    name: 'auth_tfa',
    uri: '/wikimedia.org/sys/table/auth_tfa',
    entryURI: new URI(['wikimedia.org', 'sys', 'table', 'auth_tfa', '']),
    schema: {
        table: 'auth_tfa',
        version: 1,
        attributes: {
            userid: 'string',
            key: 'string',
            tokens: 'set<string>'
        },
        index: [
            { attribute: 'userid', type: 'hash' },
        ],
        revisionRetentionPolicy: {
            type: 'latest',
            count: 1,
            grace_ttl: 0
        }
    }
};

function getFromTable(hyper, req, table) {
    return hyper.get({
        uri: table.entryURI,
        body: {
            table: table.name,
            attributes: {
                userid: req.params.userid
            }
        }
    })
    .then(function(res) {
        if (res && res.body && res.body.items && res.body.items.length) {
            return res.body.items[0];
        }
    })
    .catchReturn({ status: 404 }, undefined);
}

class Auth {
    constructor(options) {
        this.options = options;
    }

    verifyPassword(hyper, req) {
        return getFromTable(hyper, req, passwordTable)
        .then((res) => {
            if (res && res.pass_hash && res.pass_hash === authLib.hashPass(req.body.password)) {
                return { status: 200 }
            }
            throw new HTTPError({ status: 401 });
        });
    }

    resetPassword(hyper, req) {
        const token = authLib.genToken();
        return hyper.put({
            uri: tokenTable.entryURI,
            body: {
                table: tokenTable.name,
                attributes: {
                    userid: req.params.userid,
                    reset_token: token
                }
            }
        })
        .thenReturn({
            status: 201,
            body: {
                token: token
            }
        });
    }

    createPassword(hyper, req) {
        function storePass() {
            return hyper.put({
                uri: passwordTable.entryURI,
                body: {
                    table: passwordTable.name,
                    attributes: {
                        userid: req.params.userid,
                        pass_hash: authLib.hashPass(req.body.new_password)
                    }
                }
            });
        }

        function reportError() {
            throw new HTTPError({ status: 401 });
        }

        return getFromTable(hyper, req, passwordTable)
        .then((res) => {
            if (res === undefined) {
                // Now user with this userid, allow to set the password
                return storePass();
            } else {
                if (req.body.old_password && authLib.hashPass(req.body.old_password) === res.pass_hash) {
                    // Allow to store the password because old_password matched
                    return storePass();
                } else if (req.body.token) {
                    return getFromTable(hyper, req, tokenTable)
                    .then((res) => {
                        if (res && res.reset_token && res.reset_token === req.body.token) {
                            // Allow setting new password as the token is correct
                            return storePass();
                        }
                        reportError();
                    })
                }
                reportError();
            }
        });
    }

    verifyToken(hyper, req) {
        return getFromTable(hyper, req, tfaTable)
        .then(function(res) {
            if (res && res.tokens && res.tokens.some((t) => t === req.body.token)) {
                return { status: 200 };
            }
            throw new HTTPError({ status: 401 });
        })
    }

    createToken(hyper, req) {
        const key = authLib.genKey();
        const tokens = [];
        for (let i = 0; i < 5; i++) {
            tokens.push(authLib.genToken());
        }

        return hyper.put({
            uri: tfaTable.entryURI,
            body: {
                table: tfaTable.name,
                attributes: {
                    userid: req.params.userid,
                    key: key,
                    tokens: tokens
                }
            }
        })
        .thenReturn({
            status: 201,
            body: {
                key: key,
                scratch_tokens: tokens
            }
        });
    }
}

module.exports = function(options) {
    const auth = new Auth(options);
    return {
        spec: spec,
        operations: {
            verifyPassword: auth.verifyPassword.bind(auth),
            resetPassword: auth.resetPassword.bind(auth),
            createPassword: auth.createPassword.bind(auth),
            verifyToken: auth.verifyToken.bind(auth),
            createToken: auth.createToken.bind(auth),
        },
        resources: [
            {
                uri: passwordTable.uri,
                body: passwordTable.schema
            },
            {
                uri: tokenTable.uri,
                body: tokenTable.schema
            },
            {
                uri: tfaTable.uri,
                body: tfaTable.schema
            }
        ]
    }
};