/*global console, require*/

var newWall = function (majiang, inId) {
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

module.exports = newWall;
