(function() {

    window.ResidenceStore = function (verifier) {
        if (verifier.substr(verifier.length - 1, 1) != "/")
            verifier += "/";
        this.verifier = verifier;
        this.verifierTimeout = 30000;

        this.allEmails = function(email) {
            return this.storage.all().map(function (r) { return r.email; });
        };

        this.isEmailRegistered = function(email) {
            return this.storage.getResidence(email) != null;
        };

        this.residenceForEmail = function(email) {
            var residence = this.storage.getResidence(email);
            return residence ? residence.residence : null;
        };

        this.isEmailVerifying = function (email) {
            var residence = this.storage.getResidence(email);
            return residence && residence.verificationToken;
        };

        this.residenceTokenForEmail = function (email) {
            var residence = this.storage.getResidence(email);
            return residence ? residence.authorizationToken : null;
        };

        this.registerResidence = function (email, userinfo, completion) {
            if (typeof completion === "undefined" && typeof userinfo === "function") {
                completion = userinfo;
                userinfo = null;
            }
            
            if (!email || email.length == 0) {
                completion(false);
                return;
            }

            var residence = this.storage.getResidence(email);
            if (!residence) {
                residence = {
                    email: email,
                    residence: this.generateTokenForEmail(email),
                };
                this.storage.putResidence(residence);
            }

            var body = { email: residence.email, residence: residence.residence };
            if (typeof userinfo !== "undefined")
                body.userInfo = userinfo;
            
            $.ajax(this.verifier, { timeout: this.verifierTimeout, data: body, type: "POST", context: this })
                .done(function (result) {
                    if (!result.verificationToken || result.email != email) {
                        completion(false);
                    }

                    residence.verificationToken = result.verificationToken;
                    delete residence.authorizationToken;
                    this.storage.putResidence(residence);

                    completion(true);
                }, this)
                .fail(function (jqXHR, textStatus, errorThrown) {
                    completion(false, textStatus, errorThrown);
                }, this);
        }.bind(this);

        this.verifyResidence = function (email, completion) {
            if (!email || email.length == 0) {
                completion(false);
                return;
            }

            var residence = this.storage.getResidence(email);
            var token = null, residenceId = null;
            if (residence) {
                token = residence.verificationToken || residence.authorizationToken;
                residenceId = residence.residence;
            }
            
            if (!residenceId || !token) {
                completion(false);
                return;
            }

            var headers = { Authorization: token, "X-Residence": residence };
            $.ajax(this.verifier, { timeout: this.verifierTimeout, cache: false, headers: headers, type: "GET", context: this })
                .done(function (result) {
                    if (!result.authorizationToken || result.email != email) {
                        completion(false);
                    }

                    residence.authorizationToken = result.authorizationToken;
                    delete residence.verificationToken;
                    this.storage.putResidence(residence);

                    completion(true, result.authorizationToken);
                }, this)
                .fail(function (jqXHR, textStatus, errorThrown) {
                    completion(false, textStatus, errorThrown);
                }, this);
        }.bind(this);

        this.removeResidence = function (email, completion) {
            if (!email || email.length == 0) {
                completion(false);
                return;
            }

            var residence = this.storage.getResidence(email);
            var token = null, residenceId = null;
            if (residence) {
                token = residence.authorizationToken;
                residenceId = residence.residence;
            }

            if (!residenceId || !token) {
                completion(false);
                return;
            }

            var headers = { "X-Residence": residence };
            $.ajax(this.verifier + token, { timeout: this.verifierTimeout, cache: false, headers: headers, type: "DELETE", context: this })
                .done(function (result) {
                    this.storage.removeResidence(residence.email);
                    completion(true);
                }, this)
                .fail(function (jqXHR, textStatus, errorThrown) {
                    completion(false, textStatus, errorThrown);
                }, this);
        }.bind(this);

        this.uniqueIdentifierForEmail = function (email) {
            var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });

            return uuid + email;
        };

        this.generateTokenForEmail = function(email) {
            if (!email || email.length == 0)
                return null;

            var digest = this.uniqueIdentifierForEmail(email);
            var hashed = CryptoJS.SHA1(digest);
            if (!hashed)
                return null;
            
            return hashed.toString(CryptoJS.enc.Hex);
        }.bind(this);

        var store = this;
        this.storage = {
            all: function() {
                var result = [];
                for (var i = 0; i < window.localStorage.length; ++i) {
                    if (window.localStorage.key(i).indexOf("ResidenceStore#" + store.verifier) >= 0) {
                        var item = window.localStorage.getItem(window.localStorage.key(i));
                        result.push(JSON.parse(item));
                    }
                }
                return result;
            },
            
            getResidence: function(email) {
                if (!email || email.length == 0) return null;

                var key = "ResidenceStore#" + store.verifier + "#" + email;
                var data = window.localStorage[key];
                if (!data)
                    return null;

                return JSON.parse(data);
            },

            putResidence: function (residence) {
                if (!residence || !residence.email) return;
                var key = "ResidenceStore#" + store.verifier + "#" + residence.email;
                window.localStorage.setItem(key, JSON.stringify(residence));
            },

            removeResidence: function (email) {
                if (!email || email.length == 0) return;

                var key = "ResidenceStore#" + store.verifier + "#" + email;
                window.localStorage.removeItem(key);
            },
            
            removeAll: function() {
                var keys = [];
                for (var i = 0; i < window.localStorage.length; ++i) {
                    if (window.localStorage.key(i).indexOf("ResidenceStore#" + store.verifier) >= 0)
                        keys.push(window.localStorage.key(i));
                }

                for (var key in keys) {
                    window.localStorage.removeItem(key);
                }    
            }
        };
    };
})();