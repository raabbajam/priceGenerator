var ElasticSearchClient = require('elasticsearchclient');
var moment = require('moment');
var dateFormats = ['DD+MM+YYYY','DD+MMM+YYYY','DD MM YYYY','DD MMM YYYY'];
var airlines = {"airasia": 1, "citilink": 2, "garuda": 3, "lion": 4, "sriwijaya": 5, "xpress": 6};
var db = new ElasticSearchClient({
    host: 'folbek.me',
    port: 9200
});
var garuda = require('./garuda');
var lion = require('./lion');
var citilink = require('./citilink');
var merge = {
	garuda: garuda.mergeGaruda,
	citilink: citilink.mergeCitilink,
	lion: lion.mergeLion,
}
var prepareOutput = {
	garuda: garuda.prepareOutputGaruda,
	citilink: citilink.prepareOutputCitilink,
	lion: lion.prepareOutputLion,
}
var _next, _added;
function priceGenerator (airline) {
	_kode = airlines[airline] || 0;
	_airline = airline;
	return function (dt, json, cb) {
		this._dt = dt;
		this._realDt = dt;
		this._json = json;
		getCache(function (res) {
			// console.log(res);
			mergePrice(res, cb)();
		});
	};
};
function getCache (cb) {
	var ori = _dt.ori.toUpperCase();
	var dst = _dt.dst.toUpperCase();
	var query = {"size":0, "query": {"filtered": {"filter": {"and" : [{ "term": { "origin": ori } }, { "term": { "destination": dst} }, { "term": { "airline": _airline} } ] } } }, "aggs": {"groupFlight": {"terms": {"field": "flight", }, "aggs": {"groupClass": {"terms": {"field": "class", }, "aggs": {"minPrice": {"min": {"field":"price"} } } } } } } };
	// console.log(JSON.stringify(query, null, 2));
	db.search('pluto', 'price', query, function (err, res) {
		console.log('res',res, _dt.ori, _dt.dst);
		cb(prepareOutput[_airline](JSON.parse(res)).data);
	});
};
function mergePrice(res, cb) {
	var _res = res;
	var _cb = cb;
	return function () {
		this.lowestPrice = 0;
		this._next = _next || [];
		this._added = _added || [_dt.ori.toLowerCase() + _dt.dst.toLowerCase()];
		var _this = this;
		merge[_airline](_res, function (res) {
			_next = _this._next || [];
			_added = _this._added || [];

			// console.log(res);
			// console.log(lowestPrice);
			var fn;
			if (lowestPrice)
				insertLowestPrice(lowestPrice);
		 	if (fn = _next.pop()){
		 		// console.log('next');
		 		_json = res;
		 		fn(_cb)
		 	}
		 	else{
		 		// console.log(res);
				_cb(res);
		 	}
		});
	}
}
function insertLowestPrice (price) {
	var _price = parseInt(price, 10) + _kode;
	var _date = moment(_dt.dep_date, dateFormats).unix() * 1000;
	var data = {
		date: _date,
		origin: _dt.ori,
		destination: _dt.dst,
		price: _price,
		airline: _airline
	};
	data.id = data.origin + data.destination + data.date / 1000;
	// console.log('lowest',lowestPrice, JSON.stringify(data, null, 2));
	db.index('pluto', 'calendar', data, function (err, res) {
		console.log('insert', res)
	})	
}
module.exports = priceGenerator;