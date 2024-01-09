import Hls, { Fragment, FragmentLoaderConstructor, FragmentLoaderContext, HlsConfig, Loader, LoaderCallbacks, LoaderConfiguration, LoaderContext } from "hls.js";

class Segment
{
	public xhr: XMLHttpRequest = new XMLHttpRequest();
	public speed: number = 0;
	public progress: number = 0;
	public start_point: number = new Date().getTime();
	public requested: boolean = false;
	public loaded: boolean = false;
	public url: string;

	public constructor(buffer: Buffer, url: string)
	{
		this.url = url;

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
		this.start_point = new Date().getTime();
		this.xhr.send();
	}
}

class Buffer
{
	private	segments: Map<number, Segment> = new Map();
	public	playlist: Fragment[] | null = null;
	public	on_log: ((content: string) => void) | null = null;

	private format(size: number): string
	{
		return (size / 131072).toFixed(2) + " mbit/s";
	}

	public on_progress(): void
	{
		let total_speed = 0;
		this.segments.forEach(value => { total_speed += value.speed; });
		let average_speed = total_speed / this.segments.size;

		let content = "Segment        Speed  SrAS  sSrAS  Requested  Loaded  Progress\n";

		this.segments.forEach((value, key) =>
		{
			let speed_relative_average_speed = (value.speed / average_speed);
			let status_by_sras = "wait";

			if((new Date().getTime()) > value.start_point + 8000)
			{
				status_by_sras = (speed_relative_average_speed > 0.5) ? "good" : "bad";
			}

			content += key.toString().padStart(7);
			content += this.format(value.speed).padStart(13);
			content += speed_relative_average_speed.toFixed(2).toString().padStart(6);
			content += status_by_sras.padStart(7);
			content += value.requested.toString().padStart(11);
			content += value.loaded.toString().padStart(8);
			content += (Math.round(value.progress * 100).toString() + "%").padStart(10);
			content += "\n";

			if(status_by_sras == "bad" && value.loaded == false) value.retry(); // Not call this for downloaded segements.
		});

		content += `Average speed: ${this.format(average_speed)}.\n`;
		content += `Total speed: ${this.format(total_speed)}.\n`;

		if(this.on_log != null) this.on_log(content);
	}

	public abort_all(): void
	{
		this.segments.forEach(segment => segment.abort());
	}

	public take(index: any, callback: (buffer: ArrayBuffer) => void): void
	{
		if(this.playlist == null) throw new Error("Playlist information not provided.");

		// Remove out of window segments.
		this.segments.forEach((segment, segment_index) =>
		{
			if(segment_index < index || segment_index >= index + 6)
			{
				segment.abort();
				this.segments.delete(segment_index);
			}
		});

		// Add missing window segments.
		for(let i = index; i < index + 6 && i < this.playlist.length; i++)
		{
			if(this.segments.has(i) == false)
			{
				this.segments.set(i, new Segment(this, this.playlist[i].url));
			}
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
			segment.xhr.onload = (event) =>
			{
				if(segment == undefined) throw new Error("undefined_segment");
				segment.loaded = true;
				callback(segment.xhr.response);
			};
		}
	}

	public remove_segment(index: any): void
	{
		if(this.playlist == null) throw new Error("Playlist information not provided.");
		this.segments.delete(index);

		// Predict and add next segment.
		let next_index = Math.max(... this.segments.keys()) + 1;
		if(next_index < this.playlist.length) this.segments.set(next_index, new Segment(this, this.playlist[next_index].url));

		this.on_progress();
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
		this.buffer.take(context.frag.sn, (buffer) =>
		{
			callbacks.onSuccess({url: context.url, data: buffer}, this.stats, context, null);
			this.buffer.remove_segment(context.frag.sn);
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
