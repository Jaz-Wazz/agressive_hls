import Hls, { HlsConfig, FragmentLoaderConstructor, LoaderContext, LoaderConfiguration, LoaderCallbacks, LoaderStats, FragmentLoaderContext, Loader, Fragment, PlaylistLevelType } from "hls.js";

class Segment
{
	/** @type XMLHttpRequest */
	xhr = new XMLHttpRequest();

	/** @type Promise */
	promise;

	/** @type number */
	speed = 0;

	/** @type number */
	progress = 0;

	/** @type number */
	start_point = new Date().getTime();

	/** @type Url */
	url;

	/** @type boolean */
	requested = false;

	constructor(buffer: any, segment_url: any)
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
			this.xhr.onload = resolve;
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

	on_progress(event: any)
	{
		// Update segment speed.
		let elapsed_time = new Date().getTime() - this.start_point;
		let multiplier = 1000 / elapsed_time;
		this.speed = event.loaded * multiplier;
		this.progress = event.loaded / event.total;
	}

	on_error(error: any)
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

	abort()
	{
		// Propagate errors from rejected promises.
		this.promise.catch(error => this.on_error(error));

		// Abort request and reject linked promise.
		this.xhr.onabort = this.xhr.onerror;
		this.xhr.abort();
	}

	retry()
	{
		this.xhr.abort();
		this.xhr.open("GET", this.url);
		this.speed = 0;
		this.progress = 0;
		this.start_point = new Date().getTime();
		this.xhr.send();
	}
};

export class Bufferx
{
	/** @type Map<number, Segment> */
	segments = new Map();

	/** @type Promise */
	playlist: any;

	/** @type HTMLTextAreaElement */
	text_area;

	/** @type number */
	average_speed = 0;

	/** @type number */
	total_speed = 0;

	constructor(text_area: any)
	{
		console.log("Buffer created.");
		this.text_area = text_area;
	}

	format(size: any)
	{
		return (size / 131072).toFixed(2) + " mbit/s";
	}

	on_progress()
	{
		// Update total speed.
		this.total_speed = 0;
		this.segments.forEach(value => { this.total_speed += value.speed; });

		// Update average speed.
		this.average_speed = this.total_speed / this.segments.size;

		// Print header.
		this.text_area.textContent = "Segment        Speed  SrAS  sSrAS  Requested  Progress\n";

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
			+ (Math.round(value.progress * 100).toString() + "%").padStart(10)
			+ "\n";

			if(status_by_sras == "bad") value.retry();
		});

		// Print other statistics.
		this.text_area.textContent += `Average speed: ${this.format(this.average_speed)}.\n`;
		this.text_area.textContent += `Total speed: ${this.format(this.total_speed)}.\n`;
	}

	abort_all()
	{
		this.segments.forEach(segment => segment.abort());
	}

	async take(index: any)
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

		// Async wait requested segment.
		this.segments.get(index).requested = true;
		let result = await this.segments.get(index).promise;

		// Predict and add next segment.
		let next_index = Math.max(... this.segments.keys()) + 1;
		if(next_index < playlist.length) this.segments.set(next_index, new Segment(this, playlist[next_index].url));

		// Return requested segment data.
		return result.target.response;
	}

	remove_segment(index: any)
	{
		this.segments.delete(index);
		this.on_progress();
	}

	remove_requested_segments()
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

	handle_events(hls: Hls)
	{
		this.playlist = new Promise((resolve, reject) =>
		{
			hls.on(Hls.Events.LEVEL_LOADED, (event: any, data: any) =>
			{
				resolve(data.details.fragments);
			});
		});
	}
};

	// Loaderx: class Loaderx extends Hls.DefaultConfig.loader implements Loader<FragmentLoaderContext>
	// {
	// 	context: FragmentLoaderContext;
	// 	// stats: LoaderStats = null;

	// 	/** @type Buffer */
	// 	// buffer;

	// 	constructor(confg: HlsConfig)
	// 	{
	// 		super(confg);
	// 		this.context = {part: null, url: "url", responseType: "arraybuffer", frag: new Fragment(PlaylistLevelType.MAIN, "base_url")};
	// 		// this.buffer = null;
	// 		// this.context = super.context;
	// 	}

	// 	destroy() {}
	// 	abort() {}
	// 	load(context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<any>): void {}
	// }

export let buffer: Bufferx;

export function sas(): void
{
	// Make stats overlay.
	let stats_overlay = document.createElement("textarea");
	stats_overlay.spellcheck = false;
	stats_overlay.style.display = "none";
	stats_overlay.style.display = "block";
	document.body.append(stats_overlay);

	buffer = new Bufferx(stats_overlay);
}

export class Loaderx extends Hls.DefaultConfig.loader implements Loader<LoaderContext>
{
	// context: FragmentLoaderContext;
	constructor(config: any)
	{

		super(config);


		// this.buffer = config.buffer;fsfd



		// // Make stats overlay.
		// let stats_overlay = document.createElement("textarea");
		// stats_overlay.spellcheck = false;
		// stats_overlay.style.display = "none";
		// stats_overlay.style.display = "block";
		// document.body.append(stats_overlay);

		// Make hls buffer with output to logger overlay.
		// buffer = new Bufferx(stats_overlay);

		console.log("sasis");
		// let x = new Fragment(PlaylistLevelType.MAIN, "base_url");
		console.log("sasi");
		// this.context = {part: null, url: "url", responseType: "arraybuffer", frag: new Fragment(PlaylistLevelType.MAIN, "base_url")};
		console.log("sas");
	}

	async load(context: any, config: any, callbacks: any)
	{
		console.log("load");
		try
		{
			console.log(context);
			let segment = await buffer.take(context.frag.sn);
			callbacks.onSuccess({data: segment}, {}, context);
		}
		catch(error: any)
		{
			if(error.type == "abort")
			{
				callbacks.onAbort({}, context, {});
			}
			else
			{
				console.log("Segment error:", context.frag.sn, error);
				callbacks.onError({}, context, {}, {});
			}
		}
		buffer.remove_segment(context.frag.sn);
	}

	abort()
	{
		console.log("abort");
		console.log("Loader abort.");
		buffer.remove_requested_segments();
	}
}
