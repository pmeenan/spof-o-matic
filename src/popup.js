var tabId = 0;
try {
var tabId = document.URL.match(/tab=([0-9]+)/)[1].toString();
} catch (err) {
}
chrome.extension.sendRequest({msg: 'getSPOF', tab: tabId}, function(response) {
	var html = '';
	if (response['isActive']) {
		html += '<h1>Resource blocking is currently Active</h1>';
	} else {
		html += '<h1>Resource blocking is currently Disabled</h1>';
	}
	if (response['spof'] != undefined) {
		html += '<hr><h1>Possible Frontend SPOF from:</h1><ul class="hosts">';
		for (var i = 0; i < response['spof'].scripts.length; i++) {
			html += '<li>' + response['spof'].scripts[i].host + '<ul class="scripts">';
			for (var j = 0; j < response['spof'].scripts[i].scripts.length; j++) {
				html += '<li>' + response['spof'].scripts[i].scripts[j].replace(/>/g, '&gt;').replace(/</g, '&lt;') + '</li>';
			}
			html += '</ul></li>'
		}
		html += '</ul>';
	}
	document.getElementById('content').innerHTML = html;
});
