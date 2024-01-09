import Hls, { Fragment, FragmentLoaderConstructor, FragmentLoaderContext, HlsConfig, Loader, LoaderCallbacks, LoaderConfiguration, LoaderContext } from "hls.js";

class Segment
{
	private buffer: Buffer;
	public xhr: XMLHttpRequest = new XMLHttpRequest();
	public speed: number = 0;
	public speed_rel_avg: number = 0;
	public speed_rel_avg_stat: "wait" | "good" | "bad" = "wait";
	public progress: number = 0;
	public start_point: number = new Date().getTime();
	public requested: boolean = false;
	public loaded: boolean = false;
	public url: string;

	public constructor(buffer: Buffer, url: string)
	{
		this.url = url;
		this.buffer = buffer;

		this.xhr.open("GET", url);
		this.xhr.responseType = "arraybuffer";
		this.xhr.onload = () => { this.loaded = true; };
		this.xhr.onerror = error => this.on_error(error);
		this.xhr.onprogress = (event) => { this.on_progress(event); buffer.on_progress(); };
		this.xhr.setRequestHeader("Cache-Control", "no-cache, no-store, max-age=0");
		this.xhr.setRequestHeader("Expires", "Thu, 1 Jan 1970 00:00:00 GMT");
		this.xhr.setRequestHeader("Pragma", "no-cache");
		this.xhr.send();
	}

	public on_progress(event: ProgressEvent<EventTarget>): void
	{
		let elapsed_time = new Date().getTime() - this.start_point;
		let multiplier = 1000 / elapsed_time;
		this.speed = event.loaded * multiplier;
		this.progress = event.loaded / event.total;

		if(elapsed_time > 8000)
		{
			this.speed_rel_avg		= this.speed / this.buffer.speed_avg;
			this.speed_rel_avg_stat	= this.speed_rel_avg > 0.5 ? "good" : "bad";
			if(this.speed_rel_avg < 0.5 && !this.loaded) this.retry();
		}
	}

	public on_error(error: any): void
	{
		console.log("Segment error, retry:", this.url.split('/').pop(), error);
		setTimeout(() => this.retry(), 5000);
	}

	public abort(): void
	{
		this.xhr.onabort = () => console.log("Segment abort:", this.url.split('/').pop());
		this.xhr.abort();
	}

	public retry(): void
	{
		this.xhr.abort();
		this.xhr.open("GET", this.url);
		this.speed = 0;
		this.progress = 0;
		this.speed_rel_avg = 0;
		this.speed_rel_avg_stat = "wait";
		this.start_point = new Date().getTime();
		this.xhr.send();
	}
}

class Buffer
{
	private	segments: Map<number, Segment> = new Map();
	public	playlist: Fragment[] | null = null;
	public	on_log: ((content: string) => void) | null = null;
	public	speed_total: number = 0;
	public	speed_avg: number = 0;

	public on_progress(): void
	{
		this.speed_total	= [...this.segments.values()].reduce((acc, val) => acc + val.speed, 0);
		this.speed_avg		= this.speed_total / this.segments.size;

		if(this.on_log != null)
		{
			let format	= (size: number) => (size / 131072).toFixed(2) + " mbit/s";
			let content	= "Segment        Speed  SrAS  sSrAS  Requested  Loaded  Progress\n";

			for(let [index, segment] of this.segments)
			{
				content += index.toString().padStart(7);
				content += format(segment.speed).padStart(13);
				content += segment.speed_rel_avg.toFixed(2).toString().padStart(6);
				content += segment.speed_rel_avg_stat.padStart(7);
				content += segment.requested.toString().padStart(11);
				content += segment.loaded.toString().padStart(8);
				content += (Math.round(segment.progress * 100).toString() + "%").padStart(10);
				content += "\n";
			}

			content += `Average speed: ${format(this.speed_avg)}.\n`;
			content += `Total speed: ${format(this.speed_total)}.\n`;
			this.on_log(content);
		}
	}

	public take(index: number, callback: (buffer: ArrayBuffer) => void): void
	{
		if(this.playlist == null) throw new Error("Playlist information not provided.");

		for(let [i, segment] of this.segments)
		{
			if(i < index || i >= index + 6) { segment.abort(); this.segments.delete(i); }
		}

		for(let i = index; i < index + 6 && i < this.playlist.length; i++)
		{
			if(!this.segments.has(i)) this.segments.set(i, new Segment(this, this.playlist[i].url));
		}

		let segment = this.segments.get(index);
		if(segment == undefined) throw new Error(`Undefined access to ${index} segment.`);

		if(segment.loaded)
		{
			callback(segment.xhr.response);
		}
		else
		{
			segment.requested = true;
			segment.xhr.onload = () =>
			{
				if(segment == undefined) throw new Error("undefined_segment");
				if(this.playlist == null) throw new Error("Playlist information not provided.");

				segment.loaded = true;
				callback(segment.xhr.response);

				this.segments.delete(index);
				let next_index = Math.max(... this.segments.keys()) + 1;
				if(next_index < this.playlist.length) this.segments.set(next_index, new Segment(this, this.playlist[next_index].url));
				this.on_progress();
			};
		}
	}

	public make_loader(): FragmentLoaderConstructor
	{
		let buffer = this;
		class LoaderWrapper extends CustomLoader { constructor(config: HlsConfig) { super(config, buffer); } };
		return LoaderWrapper;
	}
};

class CustomLoader extends (<new (confg: HlsConfig) => Loader<FragmentLoaderContext>> Hls.DefaultConfig.loader)
{
	private buffer: Buffer;

	public constructor(config: HlsConfig, buffer: Buffer)
	{
		super(config);
		this.buffer = buffer;
	}

	public load(context: FragmentLoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>)
	{
		if(context.frag.sn == "initSegment") throw new Error("Player take 'initSegment'.");
		this.buffer.take(context.frag.sn, (buffer) =>
		{
			callbacks.onSuccess({url: context.url, data: buffer}, this.stats, context, null);
		});
	}

	public abort(): void
	{
		console.log("Loader abort.");
	}
}

window.onload = () =>
{
	let player = document.getElementById("player");
	if(!(player instanceof HTMLVideoElement)) throw new Error("Not find #player.");

	let text_area = document.createElement("textarea");
	text_area.spellcheck = false;
	document.body.append(text_area);

	let buffer	= new Buffer;
	let hls		= new Hls({fLoader: buffer.make_loader(), enableWorker: true, autoStartLoad: false});

	buffer.on_log = (content) => text_area.textContent = content;
	hls.on(Hls.Events.LEVEL_LOADED, (event, data) => { buffer.playlist = data.details.fragments; hls.startLoad(); });

	hls.loadSource('http://ia600507.s3dns.us.archive.org/e82f3235/playlist/index-muted-1IJF53JNFA.m3u8');
	hls.attachMedia(player);
};
