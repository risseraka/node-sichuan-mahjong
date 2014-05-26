/*global console*/

function servStart() {
    router.apply(this, arguments);
}

require("./commons");

// HTTP Server 
var //connect = require("connect"),
    fs = require("fs"),
    web = (typeof connect !== "undefined" ?
            connect(connect.cookieParser(),
                connect.session({
                    secret: 'keyboard cat',
                    cookie: {maxAge: 60000}
                }),
                connect.favicon(),
                servStart) :
            require("http").createServer(servStart)),
    newMajiang = require("./majiang"),
    $ = require("./domizer").$,
    then,
    server,
    router = require('./choreographer');

server = (function (router) {
    var that = {},

        games = [],

        request,
        response,
        next;

    function handleParams(callBack) {
        return function (req, res, inNext) {
            request = req;
            response = res;
            next = inNext;
            callBack.apply(that, arguments);
        };
    }

    $.gameLink = function gameLink(game, state, states) {
        return state === states.FINISHED ?
                "Game Finished" :
                $.div($.linkTo(joinSlashes(["/majiang", game, "stats"]),
                        "Game ", game),
                    " - ", state,
                    " [", game.players.getLength(), " player(s)]",
                    " - ",
                    $.linkTo(joinSlashes([
                        "/majiang",
                        game,
                        (state === states.OPEN ?
                                "join" : "specjoin")
                    ]), (state === states.OPEN ?
                            "JOIN" : "SPECTATE")));
    };

    routes = {
        "leave": function handleLeave(game) {
            delete games[game];
        },
        "games": function handleGames() {
            writePlainResponse(response, games.join("\n"));
        },
        "majiang": function handleMajiang() {
            var game = newMajiang(that);

            game.add("join");
            games[game] = game;
            writePlainResponse(response, [
                "Game Created, ID:" + game,
                "You can join with /majiang/" + game + "/join"
            ]);
        },
        "home": function handleHome() {
            var html =
                $.standardHead("Welcome to SiChuan Mahjong",
                    $.body((function () {
                        if (games.length) {
                            return games.reduce(function (res, game) {
                                if (game !== undefined) {
                                    res.push($.gameLink(game, game.getState(), game.STATES));
                                }
                                return res;
                            }, []).join("");
                        } else {
                            return $.div("No games");
                        }
                    }()),
                        $.br(),
                        $.linkTo("/majiang", "New Game"),
                        $.javascript("/client.js")));
            // console.log(html);
            writeHtmlResponse(response, html);
        }
    };

    function remove(route) {
        router.get.remove(["", route]);
    }

    function add(route) {
        router.get.add(["", route],
            handleParams(routes[route]));
    }

    function on(event, req, res, inNext, args) {
        request = req;
        response = res;
        next = inNext;
        routes[event].apply(this, args);
    }

    (function construct() {
        add("home");
        add("majiang");
        add("games");
    }());

    return that.merge({
        // properties
        "games": games,
        // accessors
        // methods
        // routing
        "on": on
    });
}(router));

// static js and css files server
router.get.add(/^\/([^\.]+)\.([^\.]+$)/,
    function handleFiles(req, res, /*next, */file, ext) {
        try {
            var type;

            switch (ext) {
            case "js":
                type = "application/x-javascript";
                break;
            case "css":
                type = "text/css";
                break;
            default:
                throw "not authorized";
            }
            fs.readFile("./static/" + file + "." + ext, function (err, content) {
                try {
                    if (err) {
                        throw err;
                    }
                    if (content) {
                        // console.log("GET", file + "." + ext + ": OK");
                        writeResponse(res, type, content);
                    }
                } catch (e) {
                    // console.log("GET", file + "." + ext + ": Not authorized");
                    router.notFound(req, res);
                }
            });
        } catch (e) {
            // console.log("GET", file + "." + ext + ": Not authorized");
            router.notFound(req, res);
        }
    });

router.get.add("/",
    function handleUI(req, res, next) {
        var html =
            $.standardHead("Welcome to SiChuan Mahjong",
                $.body(
                    $.form({id: "responseForm"},
                        $.input({
                            id: "newGameButton",
                            type: "button",
                            value: "New Game"
                        }, ""),
                        $.input({
                            id: "getGamesButton",
                            type: "button",
                            value: "List Games"
                        }, ""),
                        $.select({
                            id: "responseSelect",
                            value: "Select one..."
                        }, "")),
                    $.textarea({
                        id: "serverResponse",
                        style: "width:90%; height:90%;"
                    }, ""),
                    $.javascript({}, "/client.js")
                ));
        writeHtmlResponse(res, html);
    });

web.listen(8080);
