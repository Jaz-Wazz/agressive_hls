import Hls, { Fragment, FragmentLoaderConstructor, FragmentLoaderContext, HlsConfig, Loader, LoaderCallbacks, LoaderConfiguration, LoaderContext, PlaylistLoaderConstructor, PlaylistLoaderContext } from "hls.js";

export namespace AgressiveHls
{
	export interface Config
	{
		connection_count?: number;
		retry_slow_connections?: "off" | "relative" | "fixed";
		advanced_segment_search?: boolean;
		override_segment_extension?: string;
		supress_cache?: boolean;
	};

	export class Segment
	{
		private buffer: Buffer;
		private start_point: number = 0;
		public url: string;
		public xhr: XMLHttpRequest = new XMLHttpRequest();
		public speed: number = 0;
		public speed_rel_avg: number = 0;
		public speed_rel_avg_stat: "wait" | "good" | "bad" | "off";
		public progress: number = 0;
		public requested: boolean = false;
		public loaded: boolean = false;
		public onload: (() => any) | null = null;

		public constructor(buffer: Buffer, url: string)
		{
			this.url = url;
			this.buffer = buffer;
			this.speed_rel_avg_stat = (this.buffer.retry_slow_connections != "off") ? "wait" : "off";

			if(this.buffer.override_segment_extension != "off")
			{
				let url_without_extension = this.url.substring(0, this.url.lastIndexOf(".") + 1);
				this.url = url_without_extension + this.buffer.override_segment_extension;
			}

			this.xhr.open("GET", this.url);
			this.xhr.responseType = "arraybuffer";
			this.xhr.onload = () => { this.on_load(); };
			this.xhr.onerror = error => this.on_error(error);
			this.xhr.onprogress = (event) => { this.on_progress(event); buffer.on_progress(); };

			if(this.buffer.supress_cache)
			{
				this.xhr.setRequestHeader("Cache-Control", "no-cache, no-store, max-age=0");
				this.xhr.setRequestHeader("Expires", "Thu, 1 Jan 1970 00:00:00 GMT");
				this.xhr.setRequestHeader("Pragma", "no-cache");
			}

			this.xhr.send();
		}

		public on_load()
		{
			if(this.xhr.status == 404 && this.buffer.advanced_segment_search)
			{
				if(this.url.endsWith("-muted.ts"))
				{
					console.warn(`Segment '${this.url.split('/').pop()}' not found, transform to: 'muted -> ts'.`);
					this.url = this.url.replace("-muted.ts", ".ts");
				}
				else
				{
					console.warn(`Segment '${this.url.split('/').pop()}' not found, use transformation: 'ts -> muted'.`);
					this.url = this.url.replace(".ts", "-muted.ts");
				}
				this.retry();
				return;
			}

			this.buffer.on_progress();
			this.loaded = true;
			this.speed_rel_avg_stat = (this.buffer.retry_slow_connections != "off") ? "good" : "off";
			if(this.onload != null) this.onload();
		}

		public on_progress(event: ProgressEvent<EventTarget>): void
		{
			if(this.start_point != 0)
			{
				let elapsed_time = new Date().getTime() - this.start_point;
				let multiplier = 1000 / elapsed_time;
				this.speed = event.loaded * multiplier;
				this.progress = event.loaded / event.total;
				this.speed_rel_avg = this.speed / this.buffer.speed_avg;

				if(this.buffer.retry_slow_connections == "fixed" && elapsed_time > 8000 && !this.loaded)
				{
					let speed_in_mbits = this.speed / 131072;
					let min_speed = (12 / this.buffer.connection_count) - 0.1;
					this.speed_rel_avg_stat	= speed_in_mbits > min_speed ? "good" : "bad";
					if(speed_in_mbits < min_speed) this.retry();
				}

				if(this.buffer.retry_slow_connections == "relative" && elapsed_time > 8000 && !this.loaded)
				{
					this.speed_rel_avg_stat	= this.speed_rel_avg > 0.5 ? "good" : "bad";
					if(this.speed_rel_avg < 0.5) this.retry();
				}
			}
			else { this.start_point = new Date().getTime(); }
		}

		public on_error(error: any): void
		{
			console.warn("Segment error, retry:", this.url.split('/').pop(), error);
			setTimeout(() => this.retry(), 5000);
		}

		public abort(): void
		{
			this.xhr.onabort = () => console.info("Segment abort:", this.url.split('/').pop());
			this.xhr.abort();
		}

		public retry(): void
		{
			this.xhr.abort();
			this.xhr.open("GET", this.url);
			this.xhr.setRequestHeader("Cache-Control", "no-cache, no-store, max-age=0");
			this.xhr.setRequestHeader("Expires", "Thu, 1 Jan 1970 00:00:00 GMT");
			this.xhr.setRequestHeader("Pragma", "no-cache");
			this.speed = this.progress = this.speed_rel_avg = this.start_point = 0;
			this.speed_rel_avg_stat = (this.buffer.retry_slow_connections != "off") ? "wait" : "off";
			this.xhr.send();
		}

		public copy_response(): ArrayBuffer
		{
			if(!this.loaded)						throw new Error("Segment copy unloaded buffer.");
			if(this.xhr.readyState != 4)			throw new Error("Segment copy unready buffer.");
			if(this.xhr.response.byteLength == 0)	throw new Error("Segment copy 0 length buffer.");

			let dst = new ArrayBuffer(this.xhr.response.byteLength);
			new Uint8Array(dst).set(new Uint8Array(this.xhr.response));
			return dst;
		}
	};

	export class Buffer
	{
		private	segments: Map<number, Segment> = new Map();
		public playlist: Fragment[] | null = null;
		public on_stats_update: ((content: string) => void) | null = null;
		public speed_total: number = 0;
		public speed_avg: number = 0;

		// config
		public connection_count: number;
		public retry_slow_connections: "off" | "relative" | "fixed";
		public advanced_segment_search: boolean;
		public override_segment_extension: string;
		public supress_cache: boolean;

		public constructor(config: Config)
		{
			console.info("Buffer initialized with config:", config);
			this.connection_count = config.connection_count ?? 6;
			this.retry_slow_connections	= config.retry_slow_connections ?? "off";
			this.advanced_segment_search = config.advanced_segment_search ?? false;
			this.override_segment_extension = config.override_segment_extension ?? "off";
			this.supress_cache = config.supress_cache ?? "on";
		}

		public on_progress(): void
		{
			let runned			= [...this.segments.values()].filter(val => val.speed != 0);
			this.speed_total	= runned.reduce((acc, val) => acc + val.speed, 0);
			this.speed_avg		= this.speed_total / runned.length;

			if(this.on_stats_update != null)
			{
				let format	= (size: number) => (size / 131072).toFixed(2) + " mbit/s";
				let content	= "Segment        Speed  SrAS    RSC  Requested  Loaded  Progress\n";

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
				this.on_stats_update(content);
			}
		}

		public subscribe(index: number, callback: (buffer: ArrayBuffer) => void): void
		{
			console.group("Subscribe:", index);
			if(this.playlist == null) throw new Error("Playlist information not provided.");

			console.info("First state: ", ...this.segments.keys());

			for(let [i, segment] of this.segments)
			{
				if(i < index || i >= index + this.connection_count) { segment.abort(); this.segments.delete(i); }
			}

			for(let i = index; i < index + this.connection_count && i < this.playlist.length; i++)
			{
				if(!this.segments.has(i)) this.segments.set(i, new Segment(this, this.playlist[i].url));
			}

			if(this.segments.size != this.connection_count) this.on_progress();
			console.info("Second state:", ...this.segments.keys());

			let segment = this.segments.get(index);
			if(segment == undefined) throw new Error(`Undefined access to ${index} segment.`);

			if(segment.loaded)
			{
				callback(segment.copy_response());
				console.info("Call callback immediately, with", segment.xhr.response.byteLength, "bytes.");
			}
			else
			{
				segment.requested = true;
				console.info("Registered onload callback.");
				segment.onload = () =>
				{
					if(segment == undefined) throw new Error("undefined_segment");
					console.info("Callback triggered for", index, "segment, with", segment.xhr.response.byteLength, "bytes.");
					segment.loaded = true;
					callback(segment.copy_response());
				};
			}
			console.groupEnd();
		}

		public make_loader(): { new (confg: HlsConfig): Loader<LoaderContext>; }
		{
			console.info("Buffer make loader class.");
			let buffer = this;
			class LoaderWrapper extends CustomLoader { constructor(config: HlsConfig) { super(config, buffer); } };
			return LoaderWrapper;
		}
	};

	export class CustomLoader extends (<new (confg: HlsConfig) => Loader<LoaderContext>> Hls.DefaultConfig.loader)
	{
		private buffer: Buffer;

		public constructor(config: HlsConfig, buffer: Buffer)
		{
			super(config);
			this.buffer = buffer;
		}

		public load(context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>)
		{
			if('id' in context)
			{
				let playlist_context = context as PlaylistLoaderContext;

				fetch(playlist_context.url).then((response) =>
				{
					response.text().then((content) =>
					{
						callbacks.onSuccess({url: playlist_context.url, data: content}, this.stats, context, null);
					});
				});
			}

			if('frag' in context)
			{
				let fragment_context = context as FragmentLoaderContext;

				if(fragment_context.frag.sn == "initSegment")
				{
					let url_without_extension = fragment_context.url.substring(0, fragment_context.url.lastIndexOf(".") + 1);
					let url = url_without_extension + this.buffer.override_segment_extension;

					fetch(url).then((response) =>
					{
						response.arrayBuffer().then((buffer) =>
						{
							console.log(buffer.byteLength);
							callbacks.onSuccess({url: fragment_context.url, data: buffer}, this.stats, context, null);
						});
					});
				}
				else
				{
					this.buffer.subscribe(fragment_context.frag.sn, (buffer) =>
					{
						callbacks.onSuccess({url: fragment_context.url, data: buffer}, this.stats, context, null);
					});
				}
			}
		}

		public abort(): void
		{
			console.info("Loader abort triggered, ignorred.");
		}
	};
}
