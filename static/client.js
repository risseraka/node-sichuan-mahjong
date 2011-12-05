var gameId,
    playerId,
    action,
    tile,

    events = {};

Object.prototype.each = function each(func) {
    var prop, ret;

    for (prop in this) {
        if (this.hasOwnProperty(prop)) {
            ret = func.call(this, this[prop], prop);
            if (ret !== undefined) {
                return ret;
            }
        }
    }
};

HTMLElement.prototype.addEvent = function addEvent(event, callback) {
    events[event] = callback;
    this.addEventListener.apply(this, arguments);
};

HTMLElement.prototype.removeEvent = function removeEvent(event) {
    var callback = events[event];

    if (callback) {
        this.removeEventListener.call(this, event, callback, false);
    }
};

HTMLElement.prototype.addClickEvent = function (func) {
    this.addEventListener("click", func);
};

if (typeof String.prototype.startsWith !== 'function') {
    String.prototype.startsWith = function (str) {
        return this.slice(0, str.length) === str;
    };
}

function joinSlashes() {
    return Array.prototype.join.call(arguments, "/");
}

function buildOptions(arr) {
    var options = ["<option></option>"];

    return options.concat(arr.map(function (tile) {
        return "<option>" + tile + "</option>";
    })).join("");
}

function ajaxRequest(command, callback) {
    var xhr,
        url = ["/majiang"];

    if (!command.startsWith("/")) {
        if (gameId) {
            url.push(gameId);
            if (playerId) {
                url.push(playerId);
            }
        }
        if (command) {
            url.push(command);
        }
        url = url.join("/");
    } else {
        url = command;
    }

    console.log(url);

    xhr = new XMLHttpRequest();
    xhr.open("get", url);
    xhr.addEventListener("readystatechange", function (event) {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                // try {
                callback(xhr.responseText);
                // } catch (e) {
                    // console.log(e);
                // }
            } else if (xhr.status === 0) {
                pollFor(undefined, callback);
            }
        }
    }, false);
    xhr.send(null);
}

function output(str) {
    serverResponse.value = str + "\n" + serverResponse.value;
}

function pollFor(response, callback) {
    var line;
    if (response !== undefined) {
        line = response.split("\n").slice(-1)[0];
    }
    if (response === undefined || line.startsWith("Waiting")) {
        ajaxRequest("poll", function (response) {
            if (response !== undefined) {
                output(response.split("\n").reverse().join("\n"));
            }
            pollFor(response, callback);
        });
    } else {
        console.log("Stopping polling");
        callback(response);
    }
}

function handleResponse(response) {
    var arr = response.split("\n").reverse(), elements,
        result;

    if (!arr[0].startsWith("Waiting")) {
        result = JSON.parse(arr[0]);

        responseSelect.removeEvent("change");
        responseSelect.addEvent("change", sendMessage);

        action = result.route;
        responseSelect.innerHTML = buildOptions(result.options);
    } else {
        pollFor(undefined, handleResponse);
    }
    output(arr.join("\n"));
}

function sendMessage(event) {
    try {
        if (responseSelect.value) {
            ajaxRequest(action + "?" +
                    (action === "action" ?
                        "choice" : "tile") +
                    "=" + responseSelect.value,
                handleResponse);
        }
    } catch (e) {
        console.log(e);
    }
    event.preventDefault();
}

function sendSecret() {
    try {
        if (responseSelect.value) {
            ajaxRequest(action + "?suit=" + responseSelect.value,
                handleResponse);
        }
    } catch (e) {
        console.log(e);
    }
    event.preventDefault();
}

function setSecret(response) {
    var arr = response.split("\n").reverse();

    responseSelect.removeEvent("change");
    responseSelect.innerHTML = buildOptions(JSON.parse(arr[0]).options);
    responseSelect.addEvent("change", sendSecret);
    action = "secret";
    output(arr.join("\n"));
}

function handleReady(response) {
    var arr = response.split("\n");

    pollFor(response, setSecret);
    output(arr.reverse().join("\n"));
}

function sendReady(event) {
    try {
        if (responseSelect.value) {
            ajaxRequest(responseSelect.value, handleReady);
        }
    } catch (e) {
        console.log(e);
    }
    event.preventDefault();
}

function setReady() {
    responseSelect.removeEvent("change");
    responseSelect.innerHTML = buildOptions(["ready", "unready"]);
    responseSelect.addEvent("change", sendReady);
}

function handleJoin(response) {
    var arr = response.split("\n");

    if (arr[0] &&
            arr[0].startsWith("Joined Game")) {
        gameId = arr[0].match(/\d+$/)[0];
        playerId = arr[1].match(/\d+$/)[0];
        pollFor(response, setReady);
        output(arr.reverse().join("\n"));
    }
}

function handleNewGame(response) {
    var arr = response.split("\n");

    if (arr[0] &&
            (arr[0].startsWith("Game Created"))) {
        gameId = arr[0].match(/\d+$/)[0];
        output(arr.reverse().join("\n"));
        output("Joining Game " + gameId + "...");
        ajaxRequest("join", handleJoin);

        responseSelect.addEvent("change", sendSecret, false);
    }
}

function newGame() {
    try {
        responseSelect.removeEvent("change");

        serverResponse.value = "";
        gameId = "";
        playerId = "";
        ajaxRequest("", handleNewGame);
    } catch (e) {
        console.log(e);
    }
    event.preventDefault();
}

function sendJoin(event) {
    try {
        if (responseSelect.value) {
            ajaxRequest(responseSelect.value + "/join", handleJoin);
        }
    } catch (e) {
        console.log(e);
    }
    event.preventDefault();
}

function listGames() {
    try {
        responseSelect.removeEvent("change");

        ajaxRequest("/games", function (response) {
            var arr = response.split("\n"),
                games = "<option></option>" + arr.map(function (el) {
                    return "<option>" + el + "</option>";
                }).join("");

            responseSelect.innerHTML = games;
        });
        responseSelect.addEvent("change", sendJoin, false);
    } catch (e) {
        console.log(e);
    }
    event.preventDefault();
}

newGameButton.addEvent("click", newGame, false);
getGamesButton.addEvent("click", listGames, false);