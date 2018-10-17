
function occamy(container, opts, doc){
	if (!(this instanceof occamy)) return new occamy(container, opts, doc);
	this.doc = (!!window && !!window.document) ? window.document : doc;

	this.container = (container instanceof HTMLElement) ? container : this.doc.querySelector(container);
	this.opts = Object.assign({
		dir: null,
		prefix: "occamy",
		gap: 0,
	}, opts);

	if (typeof this.opts.gap !== 'number') this.opts.gap = parseInt(this.opts.gap,10);

	this.style();

	return this[this.opts.dir || (((this.container.offsetWidth/this.container.offsetHeight) > 1) ? "col" : "row")]();
};

// inject occamy css
occamy.prototype.style = function(){

	// prevent multiple duplicate stylesheets
	if (!!this.doc.getElementById(this.opts.prefix+"-style")) return;

	var css = this.doc.createElement("style");
	css.setAttribute("type","text/css");
	css.setAttribute("media", "screen")
	css.setAttribute("id",this.opts.prefix+"-style");

	// webkit hack
	css.appendChild(this.doc.createTextNode(""));

	this.doc.head.appendChild(css);

	css.sheet.insertRule("."+(this.opts.prefix)+"-item { display: block; position: absolute; overflow: hidden; transition: left 0.2s ease, top 0.2s ease; }",0);
	css.sheet.insertRule("."+(this.opts.prefix)+"-item > * { display: block; position: absolute; transform-origin: 50% 50%; transform: scale(0); transition: left 0.1s ease, top 0.1s ease, transform .2s ease; }",0);

	this.stylesheet = css;

	return this;

}

// redraw
occamy.prototype.redraw = function(){
	if (!this.stylesheet) this.style();
	return this[this.opts.dir || (((this.container.offsetWidth/this.container.offsetHeight) > 1) ? "col" : "row")]();
};

// destroy
occamy.prototype.destroy = function(){
	var self = this;

	// remove style from items
	[].forEach.call(self.container.getElementsByClassName(self.opts.prefix+'-item'), function(item){
		["transform","left","top"].forEach(function(p){
			item.firstChild.style.removeProperty(p);
		});
	});

	// remove dom elements
	["item","group","container"].forEach(function(c){
		var list = self.container.getElementsByClassName(self.opts.prefix+'-'+c);
		while (list.length > 0) self.unwrap(list[0]);
	});

	// remove css
	this.stylesheet.parentNode.removeChild(this.stylesheet);
	this.stylesheet = null;

	return this;
};

// wrap elements
occamy.prototype.wrap = function(e,c){
	var w = this.doc.createElement('div');
	w.classList.add(c);
	e.parentNode.insertBefore(w,e);
	w.appendChild(e);
	return this;
};

// unwrap element
occamy.prototype.unwrap = function(e){
	while (e.firstChild) e.parentNode.insertBefore(e.firstChild, e);
	e.parentNode.removeChild(e);
	return this;
};

// set css properties
occamy.prototype.css = function(e, c){
	for (var p in c) e.style[p] = c[p];
	return this;
};

// split into columns
occamy.prototype.col = function(){
	var self = this;

	// find items
	var wrapme = !(self.container.getElementsByClassName(self.opts.prefix+'-item').length > 0);
	var items = (wrapme) ? Array.from(self.container.childNodes) : Array.from(self.container.getElementsByClassName(self.opts.prefix+'-item')).reduce(function(i,n){ return i.concat(Array.from(n.childNodes)); },[]);

	if (items.length === 0) return this;

	var container_w = self.container.offsetWidth-1;
	var container_h = self.container.offsetHeight-1;
	var container_ratio = (container_h/container_w);

	var items_w = items.reduce(function(w,item){ return Math.max(w,item.offsetWidth); }, -Infinity);
	var items_h = items.reduce(function(h,item){ return h+(item.offsetHeight*(items_w/item.offsetWidth)); }, 0);

	var group_w = (items_w/(items_h/container_h));
	var group_h = container_h;

	// calculate number of groups to best fit containers aspect ratio
	var group_num = Math.min(Math.max(1,(function(){
		for (var i=0,d=Infinity;i<100;i++) { var e = Math.abs(container_ratio-((group_h/i)/(group_w*i))); if (e>d) return --i; d = e; }
	})()),items.length);

	// substract gap size from container height
	container_w -= (self.opts.gap*(group_num-1));

	// create number of groups
	var groups = Array(group_num).fill(null).map(function(gr,i){
		return { num: i, height: 0, items: [] };
	});

	// distribute items to groups
	items.sort(function(a,b){
		return a.offsetWidth/a.offsetHeight-b.offsetWidth/b.offsetHeight;
	}).forEach(function(item){
		groups = groups.sort(function(a,b){ return (a.height-b.height); });
		groups[0].height += item.offsetHeight;
		groups[0].items.push(item);
	});

	// calculate groups
	groups = groups.map(function(group){

		// temporary height to scale
		group.width = (container_w/group_num);

		// total width of items scaled to temporary height
		group.height = group.items.reduce(function(h,item){ return h+(item.offsetHeight*(group.width/item.offsetWidth)); }, 0);

		// intermediate width and height
		group.width /= (group.height/container_h);
		group.height = container_h;


		return group;
	});

	var group_total = groups.reduce(function(w,g){ return (w+g.width); },0);
	var group_scale = (container_w/group_total);

	var group_offset_x = 0;
	groups = groups.map(function(group){

		// final height of group
		group.width *= group_scale;
		group.offset_x = group_offset_x;
		group.offset_y = 0;

		group.height = (container_h-(self.opts.gap*(group.items.length-1)));

		// find total of item width scaled to final height
		group.scaleheight = group.items.reduce(function(h,item){ return h+(item.offsetHeight*(group.width/item.offsetWidth)); }, 0);

		// position items on screen
		group.items.forEach(function(item){

			if (wrapme) self.wrap(item, self.opts.prefix+"-item");

			var itemheight = ((item.offsetHeight*(group.width/item.offsetWidth)) * (group.height/group.scaleheight));

			self.css(item.parentNode, {
				display: "block",
				position: "absolute",
				top: group.offset_y+"px",
				left: group.offset_x+"px",
				height: itemheight+"px",
				width: group.width+"px",
			});

			self.css(item, {
				transform: 'scale('+(Math.min(group.width/item.offsetWidth,itemheight/item.offsetHeight))+')',
				left: ((group.width-item.offsetWidth)/2)+'px',
				top: ((itemheight-item.offsetHeight)/2)+'px',
			});

			group.offset_y += (itemheight+self.opts.gap);

		});

		group_offset_x += (group.width+self.opts.gap);

	});

	return this;
};

// split into rows
occamy.prototype.row = function(){
	var self = this;

	// find items
	var wrapme = !(self.container.getElementsByClassName(self.opts.prefix+'-item').length > 0);
	var items = (wrapme) ? Array.from(self.container.childNodes) : Array.from(self.container.getElementsByClassName(self.opts.prefix+'-item')).reduce(function(i,n){ return i.concat(Array.from(n.childNodes)); },[]);

	if (items.length === 0) return this;

	var container_w = self.container.offsetWidth-1;
	var container_h = self.container.offsetHeight-1;
	var container_ratio = (container_w/container_h);

	var items_h = items.reduce(function(h,item){ return Math.max(h,item.offsetHeight); }, -Infinity);
	var items_w = items.reduce(function(w,item){ return w+(item.offsetWidth*(items_h/item.offsetHeight)); }, 0);

	var group_h = (items_h/(items_w/container_w));
	var group_w = container_w;

	// calculate number of groups to best fit containers aspect ratio
	var group_num = Math.min(Math.max(1,(function(){
		for (var i=0,d=Infinity;i<100;i++) { var e = Math.abs(container_ratio-((group_w/i)/(group_h*i))); if (e>d) return --i; d = e; }
	})()),items.length);

	// substract gap size from container height
	container_h -= (self.opts.gap*(group_num-1));

	// create number of groups
	var groups = Array(group_num).fill(null).map(function(gr,i){
		return { num: i, width: 0, items: [] };
	});

	// distribute items to groups
	items.sort(function(a,b){
		return a.offsetHeight/a.offsetWidth-b.offsetHeight/b.offsetWidth;
	}).forEach(function(item){
		groups = groups.sort(function(a,b){ return (a.width-b.width); });
		groups[0].width += item.offsetWidth;
		groups[0].items.push(item);
	});

	// calculate groups
	groups = groups.map(function(group){

		// temporary height to scale
		group.height = (container_h/group_num);

		// total width of items scaled to temporary height
		group.width = group.items.reduce(function(w,item){ return w+(item.offsetWidth*(group.height/item.offsetHeight)); }, 0);

		// intermediate width and height
		group.height /= (group.width/container_w);
		group.width = container_w;

		return group;
	});

	var group_total = groups.reduce(function(h,g){ return (h+g.height); },0);
	var group_scale = (container_h/group_total);

	var group_offset_y = 0;
	groups = groups.map(function(group){

		// final height of group
		group.height *= group_scale;
		group.offset_y = group_offset_y;
		group.offset_x = 0;

		group.width = (container_w-(self.opts.gap*(group.items.length-1)));

		// find total of item width scaled to final height
		group.scalewidth = group.items.reduce(function(w,item){ return w+(item.offsetWidth*(group.height/item.offsetHeight)); }, 0);

		// position items on screen
		group.items.forEach(function(item){

			if (wrapme) self.wrap(item, self.opts.prefix+"-item");

			var itemwidth = ((item.offsetWidth*(group.height/item.offsetHeight)) * (group.width/group.scalewidth));

			self.css(item.parentNode, {
				display: "block",
				position: "absolute",
				top: group.offset_y+"px",
				left: group.offset_x+"px",
				height: group.height+"px",
				width: itemwidth+"px",
			});

			self.css(item, {
				transform: 'scale('+(Math.min(itemwidth/item.offsetWidth,group.height/item.offsetHeight))+')',
				left: ((itemwidth-item.offsetWidth)/2)+'px',
				top: ((group.height-item.offsetHeight)/2)+'px',
			});

			group.offset_x += (itemwidth+self.opts.gap);

		});

		group_offset_y += (group.height+self.opts.gap);

		return group;

	});

	return this;
};

if (typeof module !== 'undefined' && !!module.exports) module.exports = occamy;
