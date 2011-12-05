var parse = require('url').parse;

GLOBAL.router = (function () {
    //router, to be passed to `require('http').createServer()`
    var router = function router(req, res) {
        var path = parse(req.url).pathname,
            _routes = routes[req.method];
        if (_routes != undefined) {
            len = _routes.length;
            for (var i = 0; i < len; i += 1) {
                //say '/foo/bar/baz' matches '/foo/*/*'
                var route = _routes[i],
                    matches = route.exec(path);
                if (matches) { //then matches would be ['/foo/bar/baz','bar','baz']
                    //so turn arguments from [req,res] into [req,res,'bar','baz']
                    Array.prototype.push.apply(arguments, matches.slice(1));
                    console.log("GOT", arguments[0].url);
                    return route.callback.apply(this, arguments);
                }
            }
        }
        //route not found: no route has matched and hence returned yet
        router.notFound.apply(this, arguments);
    };
    //dictionary of arrays of routes
    var routes = {};
    //routing API
    function getRoute(route, ignoreCase) {
        if (route.constructor === RegExp) { //instanceof fails between modules
            route = new RegExp(route); //if route is already a RegExp, just clone it
        } else { //else stringify and interpret as regex where * matches URI segments
            if (route.constructor === Array) {
                route = route.join("/");
            }
            route = new RegExp('^' + //and everything else matches literally
                String(route).replace(specialChars, '\\$&').replace(/\*\*/g, '(.*)').replace(/\*/g, '([^/]*)') + '$', ignoreCase ? 'i' : '');
        }
        return route;
    }
    ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'TRACE', 'OPTIONS', 'CONNECT'].forEach(function (method) {
        routes[method] = [];
        //e.g. router.get('/foo/*',function(req,res,bar){});
        router[method.toLowerCase()] = {
            "add": function (route, ignoreCase, callback) {
                console.log("Adding route:", route);
                if (arguments.length === 2) {
                    callback = ignoreCase;
                    ignoreCase = undefined;
                }
                route = getRoute(route, ignoreCase);
                route.callback = callback;
                routes[method].push(route);
                return router;
            },
            "remove": function (route, ignoreCase) {
                console.log("Removing route:", route);
                var idx = routes[method].each(function (el, i) {
                    if (el.toString() === getRoute(route, ignoreCase).toString()) {
                        return i;
                    }
                });

                if (idx !== undefined) {
                    routes[method].splice(idx, 1);
                }
                return router;
            }
        };
    });
    //special characters that need to be escaped when passed to `RegExp()`, lest
    //they be interpreted as pattern-matching:
    var specialChars = /[|.+?{}()\[\]^$]/g;
    //creating `get` routes automatically creates `head` routes:
    routes.GET.push = function (route) { //as called by `router.get()`
        Array.prototype.push.call(this, route);
        routes.HEAD.push(route);
    };
    //404 is a route too
    router.notFound = function defaultNotFound(req, res) {
        res.writeHead(404, {
            'Content-Type': 'text/html'
        });
        res.end('<html><head><title>Error 404: Not Found</title></head><body>\n' + '<h1>Error 404: Not Found</h1>\n' + '<p>Cannot ' + req.method + ' ' + req.url + '</body></html>\n');
    };
    return router;
}());