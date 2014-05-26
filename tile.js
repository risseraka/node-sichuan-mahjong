/*global console, require*/

var SUITS = require("./suits"),

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

module.exports = newTile;
