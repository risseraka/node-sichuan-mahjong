/*global console, require*/

require("./lib");
require("./commons");

var router = require("./choreographer"),

    DEBUG = true,

    HUMAN = 0,

    SUITS = require("./suits"),

    parse = require('url').parse,

    newTile = require('./tile'),
    newWall = require('./wall'),
    newPlayer = require('./player'),
    newMajiang;

var gameIdx = 0;

newMajiang = function (server) {
    var that = {},

        id,
        state,

        routes,
        request,
        response,
        conNext,
        params,

        responses = [],
        output = [],

        MAX_SUIT = 3,
        MAX_NUMBER = 9,

        // states
        STATES = {
            OPEN: "open",
            WAITING: "waiting",
            READY: "ready",
            STARTED: "started",
            FINISHED: "stopped"
        },

        walls = [],
        middle = [],
        players = [],
        ready = [],

        specs = {},

        dong,
        currentPlayer,
        currentWall;

    function broadcastOthers(msg, exception) {
        output.push(msg);
        console.log(msg);
        players.each(function (player) {
            if (player !== exception) {
                player.print(msg);
            }
        });
    }

    function broadcast() {
        var msg = Array.prototype.join.call(arguments, " ");

        broadcastOthers(msg);
    }

    function sendToAll() {
        players.each(function (player) {
            if (player) {
                if (responses[player]) {
                    player.send(responses[player]);
                    delete responses[player];
                }
            }
        });
    }

    function displayScores() {
        players.each(function (player) {
            var fens = player.getFen();
            broadcast("PLAYER", player, "HAS", fens, "fen(s), hule:",
                player.getHuMode());
        });
    }

    function rollDices(i) {
        return {
            player: i,
            first: Math.floor(Math.random() * 6) + 1,
            second: Math.floor(Math.random() * 6) + 1
        };
    }

    function outputLists(func) {
        players.map(function (el) {
            el[func]();
        });
    }

    function outputHands() {
        outputLists("outputHand");
    }

    function outputPulls() {
        outputLists("outputPulls");
    }

    function outputMiddle() {
        outputList(middle, broadcast);
    }

    function beginBreakingWalls() {
        var player = currentPlayer;

        broadcast("Beginning breaking the walls");
        loop(4 * 3, function () {
            player.breakWall();
            player = player.getNext();
        });
        player.jumpTiles();
        player = player.getNext();
        loop(3, function () {
            player.drawOne();
            player = player.getNext();
        });
        players.each(function (player) {
            player.outputHand();
            player.add("secret");
        });
        // outputHands();
        // loop(4, function () {
               // player.sort();
            // player.computeSecret();
            // player = player.getNext();
        // });
    }

    function decideWallToBreak() {
        var dices;

        dices = rollDices(dong);
        broadcast("dong rolled dices:", dices.first, ",", dices.second);
        currentWall = walls[(dong + dices.first + dices.second - 1) % 4];
        broadcast("wall to break:", currentWall);
        currentWall.setOffset(Math.min(dices.first, dices.second) * 2);
        broadcast("tiles to skip:", currentWall.getOffset());
    }

    function decideDong() {
        var max = {
            first: 0,
            second: 0
        };

        loop(4, function (i) {
            var dices = rollDices(i);
            broadcast("Player", i, "rolled", dices.first, "and", dices.second);
            if (max.first + max.second < dices.first + dices.second) {
                max = dices;
            }
        });
        dong = players[max.player];
        broadcast("Dong:", dong);
        currentPlayer = dong;
    }

    function playersHaveActionsOnTile(tile) {
        var actions, next;

        for (next = currentPlayer.getNext();
                next !== currentPlayer; next = next.getNext()) {
            actions = next.canHu(tile);
            if (actions.length > 0) {
                return {
                    "actions": actions,
                    "player": next
                };
            }
        }
        for (next = currentPlayer.getNext();
                next !== currentPlayer; next = next.getNext()) {
            actions = next.hasActionsOnTile(tile);
            if (actions.length > 0) {
                return {
                    "actions": actions,
                    "player": next
                };
            }
        }
    }

    function stop() {
        state = STATES.FINISHED;
        broadcast("GAME OVER");
        broadcast("GAME OVER");
        broadcast("GAME OVER");
        displayScores();

        var now = Date.now();

        console.log("Start: " + new Date(then));
        console.log("End: " + new Date(now));
        console.log("Exe time: ", (+now - +then) / 1000);
        sendToAll();
    }

    function nextPlayer() {
        currentPlayer = currentPlayer.getNext();
        if (currentPlayer === currentPlayer.getNext()) {
            broadcast("3 players HULE");
            stop();
            return;
        }
        play();
        // setTimeout(play, 0);
    }

    function playAction(action, player) {
        currentPlayer = player;
        play(action);
        // setTimeout(play.pbind(action), 0);
    }

    function askPlayersForActionOnTile(tile) {
        var choices = playersHaveActionsOnTile(tile);

        if (choices) {
            // if (choices.player === players[HUMAN]) {
                choices.player.askForAction(choices);
                sendToAll();
            // } else {
                // playAction(choices.actions[0].func.pbind(tile), choices.player);
            // }
        } else {
            nextPlayer();
        }
    }

    function play(action) {
        var tile, next, actions;

        if (currentWall.tiles.length > 0 || action) {
            if (action) {
                tile = action();
                action = undefined;
            } else {
                tile = currentPlayer.drawOne();
            }
            if (currentPlayer.isActive()) {
                // broadcast("Waiting 15 secs for action of player", currentPlayer);
                actions = currentPlayer.hasActionsOnHand(tile);
                if (actions.length > 0) {
                    // if (currentPlayer === players[HUMAN]) {
                        currentPlayer.askForAction({
                            "player": currentPlayer,
                            "actions": actions
                        });
                    // } else {
                        // play(actions.shift().func);
                        // setTimeout(play.pbind(actions.shift().func), 0);
                    // }
                } else {
                    // if (currentPlayer === players[HUMAN]) {
                        currentPlayer.askForDiscard(response);
                        sendToAll();
                    // } else {
                        // tile = currentPlayer.getBestDiscard();
                        // tile = currentPlayer.discard(tile);
                        // routes.discard(currentPlayer, tile);
                    // }
                }
            } else {
                nextPlayer();
            }
        } else if (currentWall.tiles.length === 0) {
            broadcast("NO more TILES in WALL");

            printJiaos = function printJiaos(player) {
                broadcast("PLAYER", player, (function (value) {
                    return (value.length > 0) ? "JIAOS: " + value.join(", ") : "NO JIAOS";
                }(player.jiaos.getKeys())));
            };
            printJiaos(currentPlayer);
            for (next = currentPlayer.getNext();
                    next !== currentPlayer; next = next.getNext()) {
                printJiaos(next);
            }
            stop();
        }
    }

    function buildGame() {
        walls.map(function (wall, i) {
            wall.init(walls[(i + 1) % 4]);
        });
        players.map(function (player, id) {
            player.init(players[(id + 1) % 4]);
        });

        var tilesSet = (function () {
            var tilesSet = [];
            loop(MAX_SUIT, function (suit) {
                loop(MAX_NUMBER, function (number) {
                    loop(4, function () {
                        tilesSet.push(newTile(suit, number + 1));
                    });
                });
            });
            return tilesSet;
        }()).sort(function () {
            return 0.5 - Math.random();
        });

        walls.map(function (wall, i) {
            broadcast("Building wall of player", i);
            loop((13 + (i >= 2)) * 2, function () {
                wall.addTile(tilesSet.shift());
            });
        });

        decideDong();
        decideWallToBreak();
        beginBreakingWalls();
    }

    function spectate(sessionID) {
        // if (specs[sessionID]) {
            writePlainResponse(response, output);
        // } else {
            // writePlainResponse(response, "You are not entitled to spectate this game");
        // }
    }

    function addSpec(sessionID) {
        specs[sessionID] = true;
    }

    function removeSpec(sessionID) {
        delete specs[sessionID];
    }

    function start() {
        state = STATES.STARTED;
        play(function dongDiscard() {});
        // setTimeout(play.pbind(function dongDiscard() {}), 0);
    }

    function setPlayerReady(player) {
/*        if (players.each(function (player) {
                    if (player.getSessionID === sessionID) {
                        return true;
                    }
                })) {*/
        if (players[id]) {
            player.setReady();
        }
/*        }*/
    }

    function removePlayer(player) {
        if (players[player]) {
            delete players[player];
            return true;
        }
    }

    function addPlayer(sessionID) {
        if (players.getLength() < 4) {
            var id = (function () {
                    var i, j;
                    for (i = 0, j = players.length; i < j; i += 1) {
                        if (players[i] === undefined) {
                            break;
                        }
                    }
                    return i;
                }()),
                player = newPlayer(that, id, sessionID);

            players[id] = player;
            return player;
        } else {
            broadcast("Players max reached");
        }
    }

    routes = {
        "broadcast": function handleBroadCast(player, msg) {
            broadcast(msg);
        },
        "broadcastOthers": function handleBroadCast(player, msg) {
            broadcastOthers(msg, player);
        },
        "action": function handleAction(player, action) {
            if (action !== "guo") {
                playAction(action, player);
            } else {
                if (player === currentPlayer) {
                    currentPlayer.askForDiscard(response);
                    sendToAll();
                } else {
                    nextPlayer();
                }
            }
        },
        "discard": function handleDiscard(player, tile) {
            askPlayersForActionOnTile(tile);
            // setTimeout(askPlayersForActionOnTile.pbind(tile), 0);
        },
        "secret": function handleDong() {
            if (getSecretTotal() === 4) {
                start();
            }
        },
        "unready": function handleUnready(player) {
            state = STATES.OPEN;

            broadcast([
                "Player " + player + " is NOT ready",
                "Waiting for " + (4 - getReadyTotal()) +
                    " player(s) to ready up"].join("\n"));
            sendToAll();
        },
        "ready": function handleReady(player) {
            if (getReadyTotal() === 4) {
                state = STATES.READY;
                broadcast([
                    "Player " + player + " is ready",
                    "All players are ready, game starting"].join("\n"));
                buildGame();
                broadcast(JSON.stringify({
                    "route": "secret",
                    "options": ["tiao", "tong", "wan"]
                }));
            } else {
                broadcast([
                    "Player " + player + " is ready",
                    "Waiting for " + (4 - getReadyTotal()) +
                        " player(s) to ready up"].join("\n"));
            }
            sendToAll();
        },
        "poll": function handlePoll(player) {
            responses[player] = response;
        },
        "leave": function handleLeave(player) {
            if (removePlayer(player)) {
                broadcast("Player " + player + " just left the game, ID:" + id);
                player.send();
                if (players.getLength() === 0) {
                    emit("leave");
                } else if (players.getLength() === 3) {
                    add("join");
                }
            } else {
                writePlainResponse(response, "No such player, ID:" + player);
            }
        },
        "spectate": function handleSpectate() {
            spectate(request.sessionID);
        },
        "specjoin": function handleAddSpec() {
            addSpec(request.sessionID);
            writePlainResponse(response, "Added a spec in game, ID:" + id);
        },
        "join": function handleJoin() {
            var player;

            if (players.getLength() < 4) {
                player = addPlayer(request.sessionID);
                responses[player] = response;
            }
            if (players.getLength() === 4) {
                then = Date.now();
                remove("join");
                state = STATES.WAITING;
                add("specjoin");
                add("spectate");
            }
            player.print([
                "Joined Game, ID:" + id,
                "Player added, ID:" + player].join("\n"));
            broadcastOthers(["Player", player, "joined the game"].join(" "), player);
            broadcast(players.getLength() === 4 ?
                    "Game Ready" :
                    ("Waiting for " + (4 - players.getLength()) + " other player(s) to join"));
            sendToAll();
        },
        "stats": function handleStats() {
            var out = [
                "Game ID: " + id,
                "State: " + state
            ];

            players.each(function (player) {
                if (player !== undefined) {
                    out.push("Player ID: " + player +
                        " (" + (player.isReady() ? "ready" : "not ready") + ")");
                }
            });
            writePlainResponse(response, out);
        }
    };

    function handleParams(callBack) {
        return function (req, res, next) {
            request = req;
            response = res;
            conNext = next;
            params = parse(req.url).query;
            callBack.apply(that, arguments);
        };
    }

    function emit(route) {
        server.on(route, request, response, next, [that]);
    }

    function remove(route) {
        router.get.remove(["/majiang", id, route]);
    }

    function add(route) {
        router.get.add(["/majiang", id, route],
            handleParams(routes[route]));
    }

    function on(event, req, res, next, player, args) {
        request = req;
        response = res;
        conNext = next;
        responses[player] = response;
        routes[event].apply(this, args);
    }

    (function construct() {
        output.length = 0;

        id = gameIdx;
        gameIdx += 1;

        broadcast("New Game! ID:", id);

        state = STATES.OPEN;

        middle.length = 0;
        loop(4, function (id) {
            walls.push(newWall(that, id));
        });
        // loop(4, function (id) {
            // players.push(newPlayer(that, id));
        // });

        add("stats");
    }());

    function getWallsTotal() {
        return walls.reduce(function (total, el) {
            return total + el.tiles.length;
        }, 0);
    }

    function getSecretTotal() {
        return players.reduce(function (res, el) {
            return res + (el.getSecret() !== undefined);
        }, 0);
    }

    function getReadyTotal() {
        return players.reduce(function (res, el) {
            return res + (el.isReady() === true);
        }, 0);
    }

    return that.merge({
        // properties
        "walls": walls,
        "middle": middle,
        "players": players,
        "STATES": STATES,
        // accessors
        "toString": function () { return id; },
        "getId": function () { return id; },
        "getState": function () { return state; },
        "setState": function (inState) { state = inState; },
        "getDong": function () { return dong; },
        "getPlayer": function () { return currentPlayer; },
        "setPlayer": function (inPlayer) { currentPlayer = inPlayer; },
        "getWall": function () { return currentWall; },
        "setWall": function (inCurrentWall) { currentWall = inCurrentWall; },
        "getWallsTotal": getWallsTotal,
        "getReadyTotal": getReadyTotal,
        "setHttpResponse": function (res) { response = res; },
        // methods
        "stop": stop,
        "start": start,
        "buildGame": buildGame,
        "addPlayer": addPlayer,
        "removePlayer": removePlayer,
        "addSpec": addSpec,
        "removeSpec": removeSpec,
        "spectate": spectate,
        "broadcast": broadcast,
        // routing
        "add": add,
        "remove": remove,
        "on": on,
        // debug
        "outputHands": outputHands,
        "outputPulls": outputPulls,
        "outputMiddle": outputMiddle
    });
};

module.exports = newMajiang;
