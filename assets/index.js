/* Fetch the metadata on notebooks */
async function fetch_meta() {
    let data = await (await fetch('meta.json')).json();
    data.meta = parseArgs(data.cmdargs);
    data.notebooks.forEach(populateNBMeta);
    return data;
}

/* Process app metadata */
function parseArgs(args) {
    const meta = {};
    args.forEach(arg => {
	const m = arg.match(/^-{0,2}([^=]*)(=?)(.*)$/)
	meta[m[1]] = m[3] || (m[2] ? '' : true);
    });
    return meta;
}

/* Process notebook metadata */
function populateNBMeta(nb) {
    nb._id = encodeURI(nb._id);
    nb.title = nb.meta.title || nb.name.replace(/_/g, ' ');
    nb.author = null;
    if (nb.meta.authors) {
	nb.author = nb.meta.authors.map((aut) => aut.name).join(', ');
    }
}

/* Vue JS App */
(async function() {
    let db_promise = fetch_meta();

    /************* Components ***************/
    /* The app header */
    Vue.component('plyum-header', {
	props: ['meta'],
	template: `<div id="header">
  <h1 class="title"><router-link to="/">{{ meta.title }}</router-link></h1>
  <a v-if="meta.contribute" class="contribute" :href="meta.contribute" target="_blank">
    Submit a notebook
  </a>
  <p v-html="meta.description" class="description"></p>
</div>`,
    });
    
    /* The notebook thumbnail gallery */
    Vue.component('plyum-gallery', {
	data() {
	    return { expanded: !this.isThereANB() };
	},
	props: ['nbs'],
	template: `<div id="gallery" :class="expanded ? 'expanded' : 'contracted'">
  <plyum-thumb
    v-for="i in nbs"
    v-bind:nb="i"
    v-bind:key="i._id">
  </plyum-thumb>
</div>`,
	watch: {
	    // Update class when browsing occurs
	    '$route': function() {
		this.expanded = !this.isThereANB();
	    }
	},
	methods: {
	    // Test if a notebook is open in the router view
	    isThereANB() {
		return this.$router.getMatchedComponents().length > 0;
	    }
	},
	components: {
	    /* The individual thumbnails (glorified links) */
	    'plyum-thumb': {
		props: ['nb'],
		template: `<div class="thumb">
  <router-link v-bind:to="'/nb/' + nb._id">
    <div class="figure"><img v-bind:src="getThumb()"></div>
    <div class="caption">
      <span class="title">{{ nb.title }}</span>
      <span class="author" v-if="nb.author">by {{ nb.author }}</span>
    </div>
  </router-link>
</div>`,
		methods: {
		    getThumb() {
			if (this.$props.nb.meta.thumbs.length) {
			    return this.$props.nb.meta.thumbs[0];
			} else {
			    return 'assets/thumbs/jupyter.svg';
			}
		    },
		},
	    }
	},
    });

    /* The notebook view */
    const Notebook = {
	data() {
	    return {
		loading: false,
		html: null,
	    };
	},
	created() {
	    this.fetchNB();
	    this.setTitle();
	},
	watch: {
	    '$route': ['fetchNB', 'setTitle'],
	    'html': 'renderMathJax',
	},
	props: ['nb', 'meta'],
	template: `<div id="notebook-view">
  <plyum-nb-header :nb="nb" :meta="meta"></plyum-nb-header>
  <div id="notebook" v-html="html"></div>
</div>`,
	methods: {
	    fetchNB() {
	    	fetch(this.nb.path)
		    .then(res => res.text())
		    .then(html => this.html = html);
	    },
	    setTitle() {
		document.title = this.nb.title;
	    },
	    renderMathJax() {
		console.log('JAX!');
		this.$nextTick()
		    .then(() => window.MathJax.Hub.Queue(['Typeset', MathJax.Hub, 'notebook']));
	    },
	},
	components: {
	    /* The header, showing info on the notebook */
	    'plyum-nb-header': {
		props: ['nb', 'meta'],
		template: `<div class="nb-header">
  <span class="title">
    <img class="jupyter-logo" src="assets/thumbs/jupyter.svg" height="30">
    {{ nb.title }}
    <span class="author" v-if="nb.author">by {{ nb.author }}</span>
  </span>
  <span class="icons">
    <span class="kernel" title="kernel">{{ nb.meta.kernelspec.display_name }}</span>
    <a v-if="meta.baseurl" :href="downloadLink()" target="_blank">
      <span class="i-download" title="Download">⬇ Download</span>
    </a>
    <a v-if="meta.binderurl" :href="mybinderLink(nb)" target="_blank">
      <span class="i-mybinder" title="Run in MyBinder">
        <img src="assets/icons/mybinder.svg" height="16px">
        Run in MyBinder</span>
    </a>
  </span>
</div>`,
		methods: {
		    downloadLink() {
			return this.meta.baseurl.replace('%', this.nb.filename);
		    },
		    mybinderLink(nb) {
			return this.meta.binderurl.replace('%', this.nb.filename);
		    },
		},
	    },
	},
    };

    /************* Register app ***************/
    try {
	// Wait for metadata
	const data = await db_promise;
	// Init app
	let app = new Vue({
	    el: '#planetaryum',
	    data: data,
	    router: new VueRouter({
		routes: data.notebooks.map((nb) => ({
		    path: `/nb/${nb._id}`,
		    component: Notebook,
		    props: { nb: nb, meta: data.meta },
		})),
	    }),
	    created() {
		this.setTitle();
	    },
	    watch: {
		'$route': 'setTitle',
	    },
	    methods: {
		setTitle() {
		    if (this.$route.path == '/')
			document.title = this.meta.title || 'A Jupyer notebook gallery';
		},
	    },
	})
    } catch (e) {
	console.error(e);
    }
})();
