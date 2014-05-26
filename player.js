/*global console, require*/

function buildAction(func, tile) {
    return {
        "func": func.pbind(tile),
        "name": func.name,
        "tile": tile
    };
}

var router = require('./choreographer'),
    parse = require('url').parse,

    SUITS = require("./suits"),

    newPlayer = function (majiang, id, sessionID) {
    var that = {},

        ready,

        next,
        secret,
        tiles = [],
        suits = [[], [], []],
        pulls = {},
        samesInHand = {},
        jiaos = {},
        hule,
        fen,

        output = [],
        buffer = [],

        routes,
        request,
        response,
        conNext,
        params,

        waiting;

    function broadcast() {
        emit("broadcast", Array.prototype.join.call(arguments, " "));
    }

    function broadcastOthers() {
        emit("broadcastOthers", Array.prototype.join.call(arguments, " "));
    }

    function print() {
        var msg = Array.prototype.join.call(arguments, " ");

        output.push(msg);
        buffer.push(msg);
    }

    function send(res) {
        writePlainResponse(res || response, buffer);
        buffer.length = 0;
    }

    function sendAll() {
        writePlainResponse(response, output);
    }

    function outputHand() {
        outputList(tiles, print);
    }

    function outputPulls() {
        outputList(pulls, print);
    }

    function lookUpTile(tile, hand) {
        hand = hand || tiles;
        return hand.each(function (el, i) {
            if (el.equals(tile)) {
                el.index = i;
                return el;
            }
        });
    }

    function addTile(tile) {
        var i = tiles.each(function (el, i) {
            if (tile.equals(el)) {
                //TODO optimize
                tile.addKinship(el);
                el.addKinship(tile);
            }
            if (tile.sameSuit(el)) {
                if (el.getNumber() > tile.getNumber()) {
                    return i;
                }
            } else if (el.getSuit() > tile.getSuit()) {
                return i;
            }
        }) || tiles.length;

        tile.player = tile;
        tiles.splice(i, 0, tile);
        suits[tile.getSuit()].push(tile);
        samesInHand[tile] = tile.getTotal();
        return tile;
    }

    function drawOne(index) {
        var currentWall = majiang.getWall(),
            tile = currentWall.giveOne(index);

        print("Player", id, "DRAWS", tile);
        broadcastOthers("Player", id, "DRAWS 1 tile");

        tile = addTile(tile);
        return tile;
    }

    function breakWall() {
        drawOne();
        drawOne();
        drawOne();
        drawOne();
    }

    function jumpTiles() {
        broadcast("Player", id, "JUMPS tiles");
        drawOne();
        broadcast("Player", id, "JUMPS 3 tiles");
        drawOne(3);
    }

    function removeFromSuit(tile) {
        var suit = suits[tile.getSuit()];
        suit.each(function (el, i) {
            if (tile.equals(el)) {
                suit.splice(i, 1);
                return true;
            }
        });
    }

    function removeFromHand(tile) {
        var local = lookUpTile(tile);

        tiles.splice(local.index, 1);
        removeFromSuit(local);
        samesInHand.decrement(tile);
        return local;
    }

    if (!Array.prototype.removeTile) {
        Array.prototype.removeTile = function removeTile(tile) {
            this.splice(lookUpTile(tile, this).index, 1);
        };
    }

    function computeJiaos() {
        var buff = samesInHand.clone(),
            hand = tiles.clone(),
            ones = [],
            twos = [],
            threes = [],
            runs = [],
            prop;

        jiaos.clear();
        if (suits[0].length === 0 ||
                suits[1].length === 0 ||
                suits[2].length === 0) {
            console.log("Player", id, "maybe HASJIAOS:");
            getJiaos(buff, hand, ones, twos, threes, runs);
        }
        if (jiaos.getKeys().length > 0) {
            print("Player", id, "HASJIAO", jiaos.getKeys().join(", "));
            outputHand();
        }
    }

    function discard(tile) {
        var local = removeFromHand(tile);
        local.removeKinships();
        local.player = that;
        broadcast("Player", id, "DISCARDS", local);
        computeJiaos();
        majiang.middle.push(local);
        return majiang.middle.slice(-1)[0];
    }

    function sort() {
        tiles.sort(function (a, b) {
            if (a.sameSuit(b)) {
                return a.getNumber() - b.getNumber();
            }
            return a.getSuit() - b.getSuit();
        });
    }

    function getTiniestSuit(empty) {
        var min = 15, suit, zero = (empty !== undefined ? empty : 1);

        suits.each(function (el, i) {
            var len = el.length;
            if (len < min && len >= zero) {
                min = len;
                suit = i;
            }
        });
        return suit;
    }

    function computeSecret() {
        //TODO add more parameters
        secret = getTiniestSuit(0);
        broadcast("Player", id, "'s secret is", SUITS[secret]);
    }

    function getFirstOfSuit(suit) {
        return suits[suit][0];
    }

    function getFewestOfSuit(suit) {
        return suits[suit].each(function (tile) {
            if (tile.getTotal() === 1) {
                return tile;
            }
        });
    }

    function getSuitIfPossible(suit) {
        var tile = getFirstOfSuit(suit);

        if (!tile) {
            suit = getTiniestSuit();
            tile = getFewestOfSuit(suit);
            if (!tile) {
                tile = getFirstOfSuit(suit);
            }
            // broadcast("Did NOT get a secret");
        } /*else {
            // broadcast("GOT a secret");
        }*/
        return tile;
    }

    function getTileCount(tile) {
        tile = lookUpTile(tile);
        return tile && tile.getTotal();
    }

    function pullDownAsManyTilesAsThisOne(tile, number) {
        var local = lookUpTile(tile),
            all = (local ? local.getAll() : []);

        all.map(function (el) {
            if (el) {
                removeFromHand(el);
            }
        });
        pulls[tile] = (pulls[tile] || 0) + number;
    }

    function propagate(func, arg) {
        var next;
        for (next = that.getNext();
                next !== that; next = next.getNext()) {
            next[func].call(next, arg);
            that[func].call(that, arg * -1);
        }
    }

    function setInactive(mode) {
        hule = mode.from;
        var currentNext = next;

        while (next.getNext() !== that) {
            next = next.getNext();
        }
        next.setNext(currentNext);

        print("Waiting for end of game");
        send();
    }

    function peng() {
        var tile = majiang.middle.pop();

        broadcast("Player", id, "PENGS", tile, ", from", tile.player);
        pullDownAsManyTilesAsThisOne(tile, 3);
    }

    function gang() {
        var tile = majiang.middle.pop();

        broadcast("Player", id, "GANGS", tile, ", from", tile.player);
        pullDownAsManyTilesAsThisOne(tile, 4);
        tile.player.setFen(-2);
        fen += 2;
        return drawOne();
    }

    function angang(tile) {
        broadcast("Player", id, "ANGANGS", tile);
        pullDownAsManyTilesAsThisOne(tile, 4);
        propagate("setFen", -2);
        return drawOne();
    }

    function minggang(tile) {
        broadcast("Player", id, "MINGGANS", tile);
        pullDownAsManyTilesAsThisOne(tile, 1);
        propagate("setFen", -1);
        return drawOne();
    }

    function ziMo(tile) {
        if (jiaos.hasOwnProperty(tile)) {
            loop(3, skip1.compose(broadcast.lpbind(console, [
                "PLAYER", id, "ZIMOLE with", tile, "!!!"
            ])));
            propagate("setFen", -2);
            setInactive({"from": "zimo", "tile": tile});
        }
    }

    function getBestDiscard() {
        return getSuitIfPossible(secret);
    }

    function hu() {
        var tile = majiang.middle.pop();

        loop(3, skip1.compose(broadcast.lpbind(console, [
            "Player", id, "HULE with", tile, "from PLAYER", tile.player, "!!!"
        ])));
        pullDownAsManyTilesAsThisOne(tile, 1);
        tile.player.setFen(-1);
        fen += 1;
        setInactive({"from": "hu", "tile": tile});
    }

    function canHu(tile) {
        var actions = [];

        if (jiaos.hasOwnProperty(tile)) {
            actions.push(buildAction(hu, tile));
        }
        return actions;
    }

    function hasActionsOnHand(latest) {
        var actions = [], action;

        if (latest && jiaos.hasOwnProperty(latest)) {
            actions.push(buildAction(ziMo, latest));
        }
        if (majiang.getWallsTotal() > 0) {
            action = samesInHand.each(function (count, tile) {
                if (count === 4 || pulls[tile]) {
                    if (count === 4) {
                        actions.push(buildAction(angang, tile));
                    } else if (pulls[tile]) {
                        actions.push(buildAction(minggang, tile));
                    }
                }
            });
        }
        return actions;
    }

    function hasActionsOnTile(tile) {
        var actions = [], total;

        if (tile.getSuit() !== SUITS[secret]) {
            total = getTileCount(tile);
            if (total === 3 && majiang.getWallsTotal() > 0) {
                actions.push(buildAction(gang, tile));
            }
            if (total >= 2) {
                actions.push(buildAction(peng, tile));
            }
        }
        return actions;
    }

    function getTwoCardsJiaos(ones) {
        var first = ones.shift(),
            second = ones.shift(),
            suit;

        console.log("[getTwoCardsJiaos] - first:" + first, ", second:" + second);
        if (first.sameSuit(second)) {
            console.log("[getTwoCardsJiaos] - tiles have same suit");
            if (second.getNumber() < first.getNumber()) {
                console.log("[getTwoCardsJiaos] - second < first, swapping");
                (function () {
                    var backup = first;
                    first = second;
                    second = backup;
                }());
            }
            suit = first.getStringSuit();
            first = first.getNumber();
            second = second.getNumber();
            if (second === first + 1) {
                console.log("[getTwoCardsJiaos] - first:", first, "second:", second, "- ONE appart");
                if (second < 9) {
                    jiaos[(first + 2) + " " + suit] = 1;
                }
                if (first > 1) {
                    jiaos[(first - 1) + " " + suit] = 1;
                }
            } else if (second === first + 2) {
                console.log("[getTwoCardsJiaos] - first:", first, "second:", second, "- TWO appart");
                jiaos[(first + 1) + " " + suit] = 1;
            }
        }
    }

    function getRun(tile, buff, hand) {
        var number = tile.getNumber(),
            suit = SUITS[tile.getSuit()],
            next = (number + 1) + " " + suit,
            nextnext = (number + 2) + " " + suit;

        if (number < 8) {
            // console.log(["Trying to get run with:", tile].join(" "));
            // console.log([next + ":", buff[next], ", ", nextnext + ":", buff[nextnext]].join(" "));
            if (buff[next] > 0 && buff[nextnext] > 0) {
                return [tile, next, nextnext];
            }
        }
    }

    function getModeJiao(tile, mode, fork, buff, hand, ones, twos, threes, runs) {
        if (fork === true) {
            console.log(["FORKING", tile, mode].join(" "));
            buff = buff.clone();
            hand = hand.clone();
            ones = ones.clone();
            twos = twos.clone();
            threes = threes.clone();
            runs = runs.clone();
        } else {
            console.log(["NOT FORKING", tile, mode].join(" "));
        }
        switch (mode) {
        case "three":
            buff.decrement(tile, 3);
            hand.removeTile(tile);
            hand.removeTile(tile);
            threes.push(tile);
            break;
        case "pair":
            buff.decrement(tile, 2);
            hand.removeTile(tile);
            twos.push(tile);
            break;
        case "run":
            var run = getRun(tile, buff, hand);

            buff.decrement(tile);
            buff.decrement(run[1]);
            buff.decrement(run[2]);
            hand.removeTile(run[1]);
            hand.removeTile(run[2]);
            runs.push(run);
            break;
        case "solo":
            buff.decrement(tile);
            ones.push(tile);
            if (ones.length > 2) {
                console.log("ABORTING, number of ones > 2, ones =", ones.length);
                return;
            }
            break;
        default:
            throw "Error in getModeJiao, no such mode: " + mode;
        }
        getJiaos(buff, hand, ones, twos, threes, runs);
    }

    function getJiaos(buff, hand, ones, twos, threes, runs) {
        var tile, count, fork = false, left, run;

        if (hand.length > 0) {
            console.log("Before hand:", hand.join(", "));
            tile = hand.shift();
            count = buff[tile];
            if (count > 2) {
                fork = true;
                getModeJiao(tile, "three", fork, buff, hand,
                    ones, twos, threes, runs);
            }
            if (count > 1) {
                fork = true;
                getModeJiao(tile, "pair", fork, buff, hand,
                    ones, twos, threes, runs);
            }
            if (count > 0) {
                run = getRun(tile, buff, hand);
                if (run) {
                    fork = true;
                    getModeJiao(tile, "run", fork, buff, hand,
                        ones, twos, threes, runs);
                }
                fork = false;
                getModeJiao(tile, "solo", fork, buff, hand,
                    ones, twos, threes, runs);
            }
        } else {
            left = ones.length;
            console.log(["left:", left, "| ones:", ones, ", twos:", twos, ", threes:", threes.join(",")].join(" "));
            if (left === 0) {
                if (twos.length === 2) {
                    jiaos[twos[0]] = 1;
                    jiaos[twos[1]] = 1;
                } else if (threes.length === 1 && twos.length === 5) {
                    jiaos[threes[0]] = "longqidui";
                }
            } else if (left === 1 &&
                    (twos.length === 0 || twos.length === 6)) {
                jiaos[ones[0]] = 1;
            } else if (left === 2 && twos.length === 1) {
                console.log("Getting two cards jiaos");
                getTwoCardsJiaos(ones);
            }
            print("Player", id, " jiaos:", jiaos.getKeys().join(", "));
            outputHand();
        }
    }

    function setFen(inFen) {
        fen += inFen;
    }

    function askForAction(choices) {
        print("You have actions, waiting for your response");
        print(JSON.stringify({
            "route": "action",
            "options": choices.actions.map(function (action) {
                return action.name;
            }).concat(["guo"])
        }));
        broadcastOthers([
            "One player has actions",
            "Waiting for response"].join("\n"));
        add("action", choices);
        waiting = true;
    }

    function askForDiscard(response) {
        print("Your turn, waiting for tile to discard");
        print(JSON.stringify({
            "route": "discard",
            "options": tiles.map(function (tile) {
                return tile.toString();
            })
        }));
        // outputList(tiles, print);
        broadcastOthers("Waiting for Player", id, "to discard");
        add("discard");
        waiting = true;
    }

    routes = {
        "output": function handleOutput() {
            sendAll();
        },
        "action": function handleAction(choices) {
            remove("action");

            var result = params.choice,
                action;

            if (result === "guo") {
                waiting = false;
                emit("action", "guo");
            } else {
                action = choices.actions.each(function (el) {
                    if (el.name === result) {
                        return el.func;
                    }
                });

                if (action) {
                    // writePlainResponse(response, "OK");
                    emit("action", action);
                } else {
                    broadcast("No such action:", result);
                    askForAction(choices);
                    return false;
                }
            }
        },
        "discard": function handleDiscard() {
            var result = params.tile,
                tile = lookUpTile(result);

            if (tile) {
                remove("discard");
                tile = discard(tile);
                waiting = false;
                // writePlainResponse(response, "OK");
                emit("discard", tile);
            } else {
                writePlainResponse(response, "No such tile in hand, " + result);
                askForDiscard(response);
                return false;
            }
        },
        "secret": function handleSecret() {
            var result = params.suit,
                suit = SUITS.getValues().each(function (suit, i) {
                    if (suit === result) {
                        return i;
                    }
                });

            if (suit) {
                remove("secret");
                secret = suit;
                print("Selected suit:", SUITS[suit]);
                if (majiang.getPlayer() !== that) {
                    waiting = true;
                    print("Waiting");
                    send();
                }
                emit("secret");
            } else {
                writePlainResponse(response, "No such suit, " + result);
            }
        },
        "unready": function handleUnready() {
            remove("unready");
            add("ready");

            ready = false;

            emit("unready");
        },
        "ready": function handleReady() {
            remove("ready");
            add("unready");

            ready = true;

            emit("ready");
        },
        "leave": function handleLeave() {
            remove("leave");

            if (ready) {
                remove("unready");
            } else {
                remove("ready");
            }

            emit("leave");
        },
        "poll": function handlePoll() {
            emit("poll");
        }
    };

    function emit(route, data) {
        majiang.on(route, request, response, next, that, [that, data]);
    }

    function remove(route) {
        router.get.remove(["/majiang", majiang.getId(), id, route]);
    }

    function add(route, data) {
        var args = [];
        args[data && data.constructor === Array ?
                "concat" : "push"](data);
        router.get.add(["/majiang", majiang.getId(), id, route],
            (function handleParamsClosure(callBack, data) {
                return function handleParams(req, res, next) {
                    request = req;
                    response = res;
                    conNext = next;
                    params = parse(req.url, true).query;
                    callBack.apply(that, data);
                };
            }(routes[route], args)));
    }

    function init(inNext) {
        var prop;

        next = inNext;
        secret = undefined;
        tiles.length = 0;
        suits.each(function (el) {
            el.length = 0;
        });
        pulls.clear();
        samesInHand.clear();
        jiaos.clear();
        hule = false;
        fen = 0;
    }

    (function construct() {
        output.length = 0;
        buffer.length = 0;

        add("poll");
        add("leave");
        add("ready");
        add("output");
    }());

    return that.merge({
        /**/
        "tiles": tiles,
        "pulls": pulls,
        "jiaos": jiaos,
        /**/
        "toString": function () { return id; },
        "getId": function () { return id; },
        "getSessionID": function () { return sessionID; },
        "isReady": function () { return ready === true; },
        "setReady": function () { ready = true; },
        "setNotReady": function () { ready = false; },
        "getNext": function () { return next; },
        "setNext": function (inNext) { next = inNext; },
        "getSecret": function () { return secret; },
        "getHuMode": function () { return hule; },
        "isActive": function () { return hule === false; },
        "setInactive": setInactive,
        "setFen": setFen,
        "getFen": function () { return fen; },
        /**/
        "init": init,
        "drawOne": drawOne,
        "breakWall": breakWall,
        "jumpTiles": jumpTiles,
        "computeSecret": computeSecret,
        "lookUpTile": lookUpTile,
        "discard": discard,
        "hasActionsOnHand": hasActionsOnHand,
        "hasActionsOnTile": hasActionsOnTile,
        "canHu": canHu,
        "getBestDiscard": getBestDiscard,
        "computeJiaos": computeJiaos,
        "askForDiscard": askForDiscard,
        "askForAction": askForAction,
        "print": print,
        "send": send,
        // routing
        "add": add,
        "remove": remove,
        // debug
        "outputHand": outputHand,
        "outputPulls": outputPulls
    });
};

module.exports = newPlayer;
