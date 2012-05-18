var tabId = 0;
var spofEditMode = false;
try {
var tabId = document.URL.match(/tab=([0-9]+)/)[1].toString();
} catch (err) {
}

function AttachButtons() {
  var buttons = document.querySelectorAll("button.enable");
  for (var i = 0, length = buttons.length; i < length; i++) {
      buttons[i].addEventListener('click', spofEnable);
  }
  buttons = document.querySelectorAll("button.disable");
  for (var i = 0, length = buttons.length; i < length; i++) {
      buttons[i].addEventListener('click', spofDisable);
  }
  buttons = document.querySelectorAll("button.reset");
  for (var i = 0, length = buttons.length; i < length; i++) {
      buttons[i].addEventListener('click', spofReset);
  }
  buttons = document.querySelectorAll("button.edit");
  for (var i = 0, length = buttons.length; i < length; i++) {
      buttons[i].addEventListener('click', spofEdit);
  }
  buttons = document.querySelectorAll("button.return");
  for (var i = 0, length = buttons.length; i < length; i++) {
      buttons[i].addEventListener('click', spofReturn);
  }
  var buttons = document.querySelectorAll("button.remove");
  for (var i = 0, length = buttons.length; i < length; i++) {
      buttons[i].addEventListener('click', spofRemoveWhitelist);
  }
  var buttons = document.querySelectorAll("button.add");
  for (var i = 0, length = buttons.length; i < length; i++) {
      buttons[i].addEventListener('click', spofAddWhitelist);
  }
}

function onWhitelist(host, whitelist) {
  var found = false;
  if (whitelist != undefined && whitelist.length) {
    for (i= 0; i < whitelist.length && !found; i++) {
      if (host == whitelist[i]) {
        found = true;
      }
    }
  }
  return found;
}

function spofUpdate() {
  if (spofEditMode) {
    chrome.extension.sendRequest({msg: 'getLists', tab: tabId}, function(response) {
      var html = '';
      if (response['isActive']) {
        html += '<h1>Resource blocking is currently Active <button class="disable">Disable</button><button class="reset">Reset</button><button class="return">Return</button></h1>';
      } else {
        html += '<h1>Resource blocking is currently Disabled <button class="enable">Enable</button><button class="reset">Reset</button><button class="return">Return</button></h1>';
        html += '<span class="note">(For best results, exit Chrome and start a new instance before enabling resource blocking)</span>';
      }
      html += '<hr><h1>Detected Third-Party Domains:</h1><ul class="domains">';
      if (response['block'] != undefined) {
        var hosts = response['block'];
        hosts.sort(function(a,b){
          var tldRegex = /[-\w]+\.(?:[-\w]+\.xn--[-\w]+|[-\w]{3,}|[-\w]+\.[-\w]{2})$/i;
          var aTLD = a.match(tldRegex).toString();
          var bTLD = b.match(tldRegex).toString();
          return aTLD.localeCompare(bTLD);
        });
        for (var i = 0; i < hosts.length; i++) {
          var host = hosts[i];
          if (onWhitelist(host, response['whitelist'])) {
            html += '<li class="whitelist"><span class="host">' + host + '</span> - whitelisted <button host="' + host + '" class="remove">Remove</button>';
          } else {
            html += '<li><span class="host">' + host + '</span> - <button host="' + host + '" class="add">Whitelist</button>';
          }
        }
      } else {
        html += 'No third-party domains detected.  Try browsing around for a while first to build a list.';
      }
      html += '</ul>';
      document.getElementById('content').innerHTML = html;
      AttachButtons();
    });
  } else {
    chrome.extension.sendRequest({msg: 'getSPOF', tab: tabId}, function(response) {
      var html = '';
      if (response['isActive']) {
        html += '<h1>Resource blocking is currently Active <button class="disable">Disable</button><button class="reset">Reset</button><button class="edit">Edit</button></h1>';
      } else {
        html += '<h1>Resource blocking is currently Disabled <button class="enable">Enable</button><button class="reset">Reset</button><button class="edit">Edit</button></h1>';
        html += '<span class="note">(For best results, exit Chrome and start a new instance before enabling resource blocking)</span>';
      }
      if (response['blocked'] != undefined) {
        html += '<hr><h1>Blocked:</h1><ul class="hosts">';
        for (host in response['blocked']) {
          html += '<li><span class="host">' + host + '</span> - <button host="' + host + '" class="add">Whitelist</button>';
          html += '<ul class="scripts">';
          for (var i = 0; i < response['blocked'][host].length; i++) {
            html += '<li class="blocked">' + response['blocked'][host][i].replace(/>/g, '&gt;').replace(/</g, '&lt;') + '</li>';
          }
          html += '</ul></li>'
        }
        html += '</ul>';
      }
      if (response['spof'] != undefined) {
        html += '<hr><h1>Possible Frontend SPOF from:</h1><ul class="hosts">';
        for (var i = 0; i < response['spof'].scripts.length; i++) {
          var host = response['spof'].scripts[i].host;
          if (response['spof'].scripts[i].whitelist) {
            html += '<li class="whitelist"><span class="host">' + host + '</span> - whitelisted <button host="' + host + '" class="remove">Remove</button>';
          } else {
            html += '<li><span class="host">' + host + '</span> - <button host="' + host + '" class="add">Whitelist</button>';
          }
          html += '<ul class="scripts">';
          for (var j = 0; j < response['spof'].scripts[i].scripts.length; j++) {
            var position = response['spof'].scripts[i].scripts[j].position.toFixed(0);
            var group = Math.floor(position / 10);
            var script = response['spof'].scripts[i].scripts[j].script.replace(/>/g, '&gt;').replace(/</g, '&lt;');
            html += '<li class="pos' + group + '"> (<b>' + position + '</b>%) - ' + script + '</li>';
          }
          html += '</ul></li>'
        }
        html += '</ul>';
      }
      document.getElementById('content').innerHTML = html;
      AttachButtons();
    });
  }
}

function spofEdit() {
  spofEditMode = true;
	spofUpdate();
}

function spofReturn() {
  spofEditMode = false;
	spofUpdate();
}

function spofDisable() {
	chrome.extension.sendRequest({'msg': 'disable'}, function(response) {});
	spofUpdate();
}

function spofEnable() {
	chrome.extension.sendRequest({'msg': 'enable'}, function(response) {});
	spofUpdate();
}

function spofReset() {
	chrome.extension.sendRequest({'msg': 'reset'}, function(response) {});
	spofUpdate();
}

function spofRemoveWhitelist(e) {
	chrome.extension.sendRequest({'msg': 'wl_remove', 'host': e.target.getAttribute('host')}, function(response) {});
	spofUpdate();
}

function spofAddWhitelist(e) {
	chrome.extension.sendRequest({'msg': 'wl_add', 'host': e.target.getAttribute('host')}, function(response) {});
	spofUpdate();
}

spofUpdate();