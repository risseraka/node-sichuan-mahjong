/*global console, require*/

require("./lib");
require("./commons");
require("./choreographer");

var DEBUG = true,

    HUMAN = 0,

    SUITS = {
        "0": "tiao",
        "1": "tong",
        "2": "wan"
    },

    parse = require('url').parse,

    newWall,
    newTile,
    newPlayer,
    newMajiang;

function decrement(obj, prop, number) {
    var dec = number || 1;
    if (obj[prop] > dec) {
        obj[prop] -= dec;
    } else {
        delete obj[prop];
    }
}

function outputList(list, callBack) {
    if (list && list.join) {
        callBack(list.join(", "));
    }
}

newTile = function (inSuit, inNumber) {
    var that = {},
        suit,
        number,
        /*location = undefined;*/
        kinships;

    function init() {
        suit = inSuit;
        number = inNumber;
        kinships = [that];
    }

    function sameNumber(b) {
        return b.getNumber() === number;
    }

    function sameSuit(b) {
        return b.getSuit() === suit;
    }

    function equals(b) {
        if (typeof b === "object") {
            return (that.toString() === b.toString());
        } else if (typeof b === "string") {
            return that.toString() === b;
        } else {
            throw "Error in equals, type cannot be different from object or string";
        }
    }

    function addKinship(b) {
        if (equals(b)) {
            kinships.unshift(b);
            //TODO optimize
        }
    }

    function removeKinship(b) {
        kinships.each(function (tile, i) {
            if (tile === b) {
                kinships.splice(i, 1);
                return true;
            }
        });
    }

    function removeKinships() {
        kinships.each(function (tile) {
            if (tile !== that) {
                tile.removeKinship(that);
            }
        });
        kinships.length = 0;
    }

    init();

    return that.merge({
        /**/
        "toString": function () { return number + " " + SUITS[suit]; },
        "getSuit": function () { return suit; },
        "getStringSuit": function () { return SUITS[suit]; },
        "getNumber": function () { return number; },
        "getTotal": function () { return kinships.length; },
        "getAll": function () { return kinships; },
        /**/
        "sameSuit": sameSuit,
        "sameNumber": sameNumber,
        "equals": equals,
        "addKinship": addKinship,
        "removeKinship": removeKinship,
        "removeKinships": removeKinships
    });
};

newWall = function (majiang, inId) {
    var that = {},
        id = inId,
        tiles = [],
        currentOffset,
        next;

    function init(inNext) {
        next = inNext;
        tiles.length = 0;
        currentOffset = 0;
    }

    function addTile(tile) {
        tiles.push(tile);
    }

    function giveOne(index) {
        index = index || 0;
        var offset = currentOffset + index,
            tile;

        if (tiles.length - offset < 1) {
            tile = next.giveOne(index - tiles.length - offset);
        } else {
            tile = tiles.splice(offset, 1)[0];
            if (tiles.length - currentOffset === 0) {
                // majiang.broadcast("No tiles left in wall", id,
                    // "at offset", currentOffset);
                majiang.setWall(next);
                next.setOffset(0);
            }
        }
        return tile;
    }

    return that.merge({
        /**/
        "tiles": tiles,
        /**/
        "toString": function () { return id; },
        "getOffset": function () { return currentOffset; },
        "setOffset": function (inOffset) { currentOffset = inOffset; },
        "getNext": function () { return next; },
        "setNext": function (inNext) { next = inNext; },
        /**/
        "init": init,
        "addTile": addTile,
        "giveOne": giveOne
    });
};

function buildAction(func, tile) {
    return {
        "func": func.pbind(tile),
        "name": func.name,
        "tile": tile
    };
}

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

exports.newMajiang = newMajiang;