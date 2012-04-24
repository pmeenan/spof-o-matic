var active = false;
var blockList = new Array();
var blockHosts = new Array();
var detected_spof = {};
var badges = {};
var tab_icons = {};

var SPOF_LIST = 'http://spof.webpagetest.org/';
var ICON_ACTIVE = "active.png";
var ICON_INACTIVE = "inactive.png";
var ICON_BLOCKED = "blocked.png";
var ICON_DETECTED = "detected.png";
var ICON_DEFAULT = ICON_INACTIVE;

chrome.webRequest.onBeforeRequest.addListener(
  function(info) {
		var action = {};
		if (info.type == 'main_frame') {
			detected_spof[info.tabId] = {};
			SetBadge(info.tabId, ICON_DEFAULT);
			delete detected_spof[info.tabId];
		}
		if (active && info.type == 'script' && BlockURL(info.url)) {
			SetBadge(info.tabId, ICON_BLOCKED)
			console.log("blocking: " + info.url);
			action.redirectUrl = 'https://blackhole.webpagetest.org/';
		}
    return action;
  },
  // filters
  {
    urls: [
      "http://*/*",
      "https://*/*",
    ]
  },
  // extraInfoSpec
  ["blocking"]
);

chrome.webRequest.onCompleted.addListener(
  function(info) {
		if (info.method == 'GET') {
			try {
				var xhr = new XMLHttpRequest();
				console.log('Fetching ' + info.url);
				xhr.open('GET', info.url, true);
				xhr.onreadystatechange = function() {
					if (xhr.readyState != 4)
						return;
					if (xhr.status == 200) {
						spofCheck(info.tabId, info.url, xhr.responseText);
					}
				};
				xhr.send();
			} catch (err) {}
		}
    return {};
  },
  // filters
  {
    urls: [
      "http://*/*",
      "https://*/*",
    ],
		types: ['main_frame']
  }
);

/*
	See if we need to block the given URL
*/
function BlockURL(url) {
	var block = false;
	// get the host name
	var hostRegex = new RegExp('[^/]*//([^/]+)', 'im');
	var host = url.match(hostRegex)[1].toString();
	for (i = 0; i < blockList.length && !block; i++) {
		var blockRegex = new RegExp(blockList[i], 'im');
		if (blockRegex.test(host)) {
			block = true;
		}
	}
	for (i = 0; i < blockHosts.length && !block; i++) {
		if (blockHosts[i] == host) {
			block = true;
		}
	}

	if (block) {
		console.log("blocking: " + url);
	}
	return block;
}

function UpdateBlockList() {
	console.log('Updating blockList');
	blockHostsStr = localStorage['hosts'];
	if (blockHostsStr && blockHostsStr.length) {
		blockHosts = JSON.parse(blockHostsStr);
		console.log('Local block list:');
		console.log(blockHosts);
	}
	
	try {
	  var xhr = new XMLHttpRequest();
	  xhr.open('GET', SPOF_LIST, true);
	  xhr.onreadystatechange = function() {
			if (xhr.readyState != 4)
				return;
			if (xhr.status == 200) {
				blockList = JSON.parse(xhr.responseText);
				console.log('Server block list:');
				console.log(blockList);
			}
	  };
	  xhr.onerror = function() {
		console.log('Got an XHR error!');
	  };
	  xhr.send();
	} catch (err) {
	  console.log('XHR Error: ' + err);
	}
}

UpdateBlockList();

function SetBadge(tab_id, popupIcon) {
	var popupUrl = "popup.html?tab=" + tab_id;
	chrome.browserAction.setPopup({tabId: tab_id, popup: popupUrl});
	chrome.browserAction.setIcon({tabId: tab_id, path: popupIcon});
	tab_icons[tab_id] = popupIcon;
}

function RefreshBadge(tab_id) {
	if (tab_icons[tab_id] != undefined) {
		SetBadge(tab_id, tab_icons[tab_id]);
	}
}

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	// refresh the badge every time the tab state changes, otherwise Chrome tends to revert to the default
	RefreshBadge(tabId);
});

/*********************************************************************************
**********************************************************************************
**
**	Communication with the pop-up
**
**********************************************************************************
**********************************************************************************/
function onRequest(request, sender, sendResponse) {
	if (request.msg == 'getSPOF') {
		var response = {isActive: active};
		if (request['tab'] && detected_spof[request['tab']] != undefined) {
			response['spof'] = detected_spof[request['tab']];
		}
		sendResponse(response);
	}
};
chrome.extension.onRequest.addListener(onRequest);

/*********************************************************************************
**********************************************************************************
**
**	SPOF Detection logic
**
**********************************************************************************
**********************************************************************************/
function setSPOF(tab_id, spofHosts, spofScripts) {
	SetBadge(tab_id, ICON_DETECTED);
	detected_spof[tab_id] = {hosts: spofHosts, scripts: spofScripts};
	// add the hosts if we don't already know about them
	var modified = false;
	for (var i = 0; i < spofHosts.length; i++) {
		var found = false;
		for( var j = 0; j < blockHosts.length && !found; j++) {
			if (blockHosts[j].toString() == spofHosts[i]) {
				found = true;
			}
		}
		if (!found) {
			blockHosts.push(spofHosts[i]);
			modified = true;
		}
	}
	if (modified) {
		localStorage['hosts'] = JSON.stringify(blockHosts);
	}
}

function spofMatch(arr, str) {
	var found = false;
	for( var i = 0; i < arr.length && !found; i++) {
		if (arr[i].toString() == str) {
			found = true;
		}
	}
	return found;
}

function spofAddArrayElement(arr, str) {
	if (!spofMatch(arr,str)) {
		arr.push(str);
	}
}

function spofAddScript(arr, host, script) {
	var found = false;
	for( var i = 0; i < arr.length && !found; i++) {
		if (arr[i]['host'].toString() == host) {
			arr[i]['scripts'].push(script);
			found = true;
		}
	}
	if (!found) {
		arr.push({'host':host, 'scripts':[script]});
	}
}

function spofCheck(tab_id, url, pageText) {
	// build a list of "safe" host names (anything where css or images were served)
	var cssRegex = /<link [^>]*href[ =htps:"]+\/\/([^\/ "]+)\/[^>]+>/gi
	var imgRegex = /<img [^>]*src[ =htps:"]+\/\/([^\/ "]+)\/[^>]+>/gi
	var scriptRegex = /<script [^>]*src[ =htps:"]+\/\/([^\/ "]+)\/[^>]+>/gi
	var hostRegex = /(href|src)[ =htps:"]+\/\/([^\/ "]+)\//i
	var tldRegex = /[-\w]+\.(?:[-\w]+\.xn--[-\w]+|[-\w]{3,}|[-\w]+\.[-\w]{2})$/i
	var asyncRegex = /async[ ]*=/i
	var safeTLDs = new Array();
	var thirdParty = new Array();
	var spofHosts = new Array();
	var spofScripts = new Array();

	safeTLDs.push(url.match(/[^\/]*\/\/([^\/]+)/)[1].toString().match(tldRegex).toString());
	var matches = pageText.match(cssRegex);
	if (matches) {
		for (var i = 0; i < matches.length; i++) {
			try {
				spofAddArrayElement(safeTLDs, matches[i].toString().match(hostRegex)[2].toString().match(tldRegex).toString());
			} catch(err) {}
		}
	}
	matches = pageText.match(imgRegex);
	if (matches) {
		for (var i = 0; i < matches.length; i++) {
			try {
				spofAddArrayElement(safeTLDs, matches[i].toString().match(hostRegex)[2].toString().match(tldRegex).toString());
			} catch(err) {}
		}
	}
	console.log("Safe TLD's: " + safeTLDs);
	matches = pageText.match(scriptRegex);
	if (matches) {
		for (var i = 0; i < matches.length; i++) {
			try {
				var script = matches[i].toString();
				var host = script.match(hostRegex)[2].toString();
				var tld = host.match(tldRegex).toString();
				if (!spofMatch(safeTLDs, tld)) {
					spofAddArrayElement(thirdParty, host);
					if (!asyncRegex.test(script)) {
						spofAddArrayElement(spofHosts, host);
						spofAddScript(spofScripts, host, script);
						console.log('SPOF script: ' + script);
					}
				}
			} catch(err) {}
		}
	}
	console.log("SPOF Hosts: " + spofHosts);
	if (spofHosts.length) {
		setSPOF(tab_id, spofHosts, spofScripts);
	}
}

