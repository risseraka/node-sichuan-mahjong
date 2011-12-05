function loadLibrary(library) {
    function addFunctionToObj(object, func, name) {
        if (object !== undefined &&
                func !== undefined &&
                name !== undefined &&
                object[name] === undefined) {
            object[name] = func;
        }
    }

    var lib, libKey, object, funcKey, functions, func;

    for (libKey in library) {
        if (library.hasOwnProperty(libKey)) {
            lib = library[libKey] || {};
            object = lib.object;
            functions = lib.functions;
            for (funcKey in functions) {
                if (functions.hasOwnProperty(funcKey)) {
                    func = functions[funcKey] || {};
                    if (func) {
                        addFunctionToObj(object, func, func.name);
                    }
                }
            }
        }
    }
}

loadLibrary([{
    "object": Object.prototype,
    "functions": [
        function getKeys() {
            var keys = [];

            this.each(function (el, prop) {
                keys.push(prop);
            });
            return keys;
        },
        function getValues() {
            var values = [];

            this.each(function (el) {
                values.push(el);
            });
            return values;
        },
        function terify(prop) {
            var that = this;

            return function terifiedFucntion() {
                if (typeof this[prop] !== "function") {
                    throw new TypeError("Object.prototype.terify - what has been .terified is not callable");
                }
                that[prop].apply(that, arguments);
            };
            // equivalent to: this[prop].bind(this)
        },
        function each(func) {
            var prop, ret;

            for (prop in this) {
                if (this.hasOwnProperty(prop)) {
                    ret = func.call(this, this[prop], prop);
                    if (ret !== undefined) {
                        return ret;
                    }
                }
            }
        },
        function shift() {
            return this.each.call(this, function (el, prop) {
                delete this[prop];
                return {
                    "el": el,
                    "prop": prop
                };
            });
        },
        function clear() {
            this.each(function (el, prop) {
                delete this[prop];
            });
        },
        function clone() {
            var newThis = new this.constructor();

            this.each.call(this, function (el, prop) {
                newThis[prop] = el;
            });
            return newThis;
        },
        function merge(arr) {
            var that = this;

            arr.each(function (el, prop) {
                that[prop] = el;
            });
            return this;
        },
        function decrement(prop, dec) {
            dec = dec || 1;

            if (this[prop] > dec) {
                this[prop] -= dec;
            } else {
                delete this[prop];
            }
        }
    ]
}, {
    "object": Function.prototype,
    "functions": [
        function pbind() {
            var args = arguments,
                that = this;
            return function pbindedFunction() {
                that.apply(this, args);
            };
        },
        function loop(times) {
            var i, ret;

            if (times > 0) {
                for (i = times; i; i -= 1) {
                    ret = this(times - i);
                    if (ret !== undefined) {
                        return ret;
                    }
                }
                return ret;
            }
        },
        function pbind() {
            var that = this,
                thatArgs = Array.prototype.slice.call(arguments);

            return function pbindedFunction() {
                return that.apply(this,
                    Array.prototype.slice.call(arguments).concat(thatArgs));
            };
        },
        function lpbind(scope, args) {
            var that = this;

            return function pbindedFunction() {
                return that.apply(scope,
                    args.concat(Array.prototype.slice.call(arguments)));
            };
        },
        function compose(func) {
            var that = this;

            return function () {
                var res = that.apply(this, arguments);
                return func.apply(this, res);
            };
        }
    ]
}, {
    "object": Array.prototype,
    "functions": [
        function getLength() {
            return this.getKeys().length;
        },
        function search(key, value) {
            return this.foreach(function (el) {
                if (key) {
                    if (typeof key === "function") {
                        if (key(el) === value) {
                            return el;
                        }
                    } else {
                        if (el[key] === value) {
                            return el;
                        }
                    }
                } else if (el === value) {
                    return el;
                }
            });
        }
    ]
}]);

/* allowing gap-filling push array-like object prototype
function ArrayObj(length) {
    var last = 0;

    length = length || Infinity,
    this.push = function push() {
        var max = 0, i, j;

        for (i = 0, j = length; i < j; i += 1) {
            if (this[i] === undefined) {
                if (arguments.length > 0) {
                    this[i] = Array.prototype.shift.call(arguments);
                } else {
                    break;
                }
            }
        }
        if (i > max) {
            max = i;
        }
        if (max > last) {
            last = max;
            this.length = last;
        }
    };

    this.toString = function () {
        return Array.prototype.map.call(this, function (el) { return el }).join(", ");
    };

    this.length = length;
}

// example:
var test1 = [];
test1.push(1, 2, 3);   // [1, 2, 3]
delete test1[2];       // [1, u, 3]
var test2 = new ArrayObj();
test2.push(1, 2, 3);    // [1, 2, 3]
delete test2[1];        // [1, u, 3]
test2.push(2, 4, 5, 6); // [1, 2, 3, 4, 5, 6]
*/

exports.loadLibrary = loadLibrary;