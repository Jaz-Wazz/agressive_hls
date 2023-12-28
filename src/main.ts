import Hls, { FragmentLoaderConstructor, FragmentLoaderContext, HlsConfig, Loader, LoaderCallbacks, LoaderConfiguration, LoaderContext } from "hls.js";

class Segment
{
	public xhr: XMLHttpRequest = new XMLHttpRequest();
	public promise: Promise<ArrayBuffer>;
	public speed: number = 0;
	public progress: number = 0;
	public start_point: number = new Date().getTime();
	public requested: boolean = false;
	public loaded: boolean = false;

	/** @type Url */
	url;

	public constructor(buffer: Buffer, segment_url: any)
	{
		// Initialize url member.
		this.url = segment_url;

		// Start async task and take his promise.
		this.promise = new Promise((resolve, reject) =>
		{

			// Configure xhr object.
			this.xhr.open("GET", segment_url);
			this.xhr.responseType = "arraybuffer";

			// Connect callbacks.
			this.xhr.onload = () =>
			{
				this.loaded = true;
				resolve(this.xhr.response);
			};

			this.xhr.onerror = reject;
			this.xhr.onprogress = (event) => { this.on_progress(event); buffer.on_progress(); };

			// Supress browser cache.
			this.xhr.setRequestHeader("Cache-Control", "no-cache, no-store, max-age=0");
			this.xhr.setRequestHeader("Expires", "Thu, 1 Jan 1970 00:00:00 GMT");
			this.xhr.setRequestHeader("Pragma", "no-cache");

			// Send request.
			this.xhr.send();
		});
	}

	public on_progress(event: ProgressEvent<EventTarget>): void
	{
		// Update segment speed.
		let elapsed_time = new Date().getTime() - this.start_point;
		let multiplier = 1000 / elapsed_time;
		this.speed = event.loaded * multiplier;
		this.progress = event.loaded / event.total;
	}

	public on_error(error: any): void
	{
		if(error.type == "abort")
		{
			console.log("Segment abort:", this.url.split('/').pop());
		}
		else
		{
			console.log("Segment error:", this.url.split('/').pop(), error);
		}
	}

	public abort(): void
	{
		// Propagate errors from rejected promises.
		this.promise.catch(error => this.on_error(error));

		// Abort request and reject linked promise.
		this.xhr.onabort = this.xhr.onerror;
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
	public playlist: any;
	public text_area: HTMLTextAreaElement;
	public average_speed: number = 0;
	public total_speed: number = 0;
	public segments: Map<number, Segment> = new Map();

	public constructor(text_area: HTMLTextAreaElement)
	{
		console.log("Buffer created.");
		this.text_area = text_area;
	}

	public format(size: number): string
	{
		return (size / 131072).toFixed(2) + " mbit/s";
	}

	public on_progress(): void
	{
		// Update total speed.
		this.total_speed = 0;
		this.segments.forEach(value => { this.total_speed += value.speed; });

		// Update average speed.
		this.average_speed = this.total_speed / this.segments.size;

		// Print header.
		this.text_area.textContent = "Segment        Speed  SrAS  sSrAS  Requested  Loaded  Progress\n";

		// Print rows.
		this.segments.forEach((value, key) =>
		{
			let speed_relative_average_speed = (value.speed / this.average_speed);
			let status_by_sras = "wait";

			if((new Date().getTime()) > value.start_point + 8000)
			{
				status_by_sras = (speed_relative_average_speed > 0.5) ? "good" : "bad";
			}

			this.text_area.textContent += ""
			+ key.toString().padStart(7)
			+ this.format(value.speed).padStart(13)
			+ speed_relative_average_speed.toFixed(2).toString().padStart(6)
			+ status_by_sras.padStart(7)
			+ value.requested.toString().padStart(11)
			+ value.loaded.toString().padStart(8)
			+ (Math.round(value.progress * 100).toString() + "%").padStart(10)
			+ "\n";

			// Not call this for downloaded segements.
			if(status_by_sras == "bad" && value.loaded == false) value.retry();
		});

		// Print other statistics.
		this.text_area.textContent += `Average speed: ${this.format(this.average_speed)}.\n`;
		this.text_area.textContent += `Total speed: ${this.format(this.total_speed)}.\n`;
	}

	public abort_all(): void
	{
		this.segments.forEach(segment => segment.abort());
	}

	public async take(index: any): Promise<ArrayBuffer>
	{
		// Async wait playlist information.
		let playlist = await this.playlist;

		// Long higher jump. (Full rebuffer)
		// [10] [11] [12] [13] [14] [15] -> !20 -> [20] [21] [22] [23] [24] [25] /-> []

		// Long lower jump. (Full rebuffer)
		// [10] [11] [12] [13] [14] [15] -> !3  -> [ 3] [ 4] [ 5] [ 6] [ 7] [ 8] /-> []

		// Short higher jump. (Save: [13] [14] [15], Add: [16] [17] [18])
		// [10] [11] [12] [13] [14] [15] -> !13 -> [13] [14] [15] [16] [17] [18] /-> [13, 14, 15]

		// Short lower jump. (Save: [10] [11] [12], Add: [ 7] [ 8] [ 9])
		// [10] [11] [12] [13] [14] [15] -> !7  -> [ 7] [ 8] [ 9] [10] [11] [12] /-> [10, 11, 12]

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
		for(let i = index; i < index + 6 && i < playlist.length; i++)
		{
			if(this.segments.has(i) == false)
			{
				this.segments.set(i, new Segment(this, playlist[i].url));
			}
		}

		let segment = this.segments.get(index);
		if(segment != undefined)
		{
			segment.requested = true;
			let buffer = await segment.promise;

			// Predict and add next segment.
			let next_index = Math.max(... this.segments.keys()) + 1;
			if(next_index < playlist.length) this.segments.set(next_index, new Segment(this, playlist[next_index].url));

			// Return requested segment data.
			return buffer;
		}
		else
		{
			throw new Error(`Undefined access to ${index} segment.`);
		}
	}

	public remove_segment(index: any): void
	{
		this.segments.delete(index);
		this.on_progress();
	}

	public remove_requested_segments(): void
	{
		this.segments.forEach(async (segment, segment_index) =>
		{
			if(segment.requested == true)
			{
				// Async wait playlist information.
				let playlist = await this.playlist;

				// Abort and remove.
				segment.abort();
				this.remove_segment(segment_index);

				// Predict and add next segment.
				let next_index = Math.max(... this.segments.keys()) + 1;
				if(next_index < playlist.length) this.segments.set(next_index, new Segment(this, playlist[next_index].url));
			}
		});
	}

	public handle_events(hls: Hls): void
	{
		this.playlist = new Promise((resolve, reject) =>
		{
			hls.on(Hls.Events.LEVEL_LOADED, (event, data) =>
			{
				resolve(data.details.fragments);
			});
		});
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

	public async load(context: FragmentLoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>)
	{
		try
		{
			let segment = await this.buffer.take(context.frag.sn);
			callbacks.onSuccess({url: context.url, data: segment}, this.stats, context, null);
		}
		catch(error: any)
		{
			if(error.type == "abort" && callbacks.onAbort != undefined)
			{
				callbacks.onAbort(this.stats, context, null);
			}
			else
			{
				console.log("Segment error:", context.frag.sn, error);
				callbacks.onError({code: 0, text: "error_text"}, context, null, this.stats);
			}
		}
		this.buffer.remove_segment(context.frag.sn);
	}

	public abort(): void
	{
		console.log("Loader abort.");
		this.buffer.remove_requested_segments();
	}
}

function make_custom_loader(buffer: Buffer): FragmentLoaderConstructor
{
	class CustomLoaderWrapper extends CustomLoader
	{
		constructor(config: HlsConfig)
		{
			super(config, buffer);
		}
	};
	return CustomLoaderWrapper;
}

window.onload = () =>
{
	let text_area = document.createElement("textarea");
	text_area.spellcheck = false;
	document.body.append(text_area);

	let player = document.getElementById("player");

	if(player instanceof HTMLVideoElement)
	{
		let buffer	= new Buffer(text_area);
		let hls		= new Hls({fLoader: make_custom_loader(buffer), enableWorker: true});
		buffer.handle_events(hls);

		hls.loadSource('http://ia801302.s3dns.us.archive.org/267c08db/playlist/index-dvr.m3u8');
		hls.attachMedia(player);
	}
	else
	{
		console.error("Not find #player.");
	}
};
