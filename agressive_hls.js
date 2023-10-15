let AgressiveHls =
{
	Segment: class Segment
	{
		/** @type XMLHttpRequest */
		xhr = new XMLHttpRequest();

		/** @type Promise */
		promise;

		/** @type number */
		speed = 0;

		/** @type number */
		start_point = new Date().getTime();

		/** @type Url */
		url;

		constructor(buffer, segment_url)
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

		on_progress(event)
		{
			// Update segment speed.
			let elapsed_time = new Date().getTime() - this.start_point;
			let multiplier = 1000 / elapsed_time;
			this.speed = event.loaded * multiplier;
		}

		abort_and_retry()
		{
			this.xhr.abort();
			this.xhr.open("GET", this.url);
			this.speed = 0;
			this.start_point = new Date().getTime();
			this.xhr.send();
		}
	},

	Buffer: class Buffer
	{
		/** @type Map<number, Segment> */
		segments = new Map();

		/** @type Promise */
		playlist;

		/** @type HTMLTextAreaElement */
		text_area;

		/** @type number */
		average_speed = 0;

		/** @type number */
		total_speed = 0;

		constructor(text_area)
		{
			this.text_area = text_area;
		}

		format(size)
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
			this.text_area.textContent = "Segment        Speed  SrAS  sSrAS\n";

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
				+ "\n";

				if(status_by_sras == "bad") value.abort_and_retry();
			});

			// Print other statistics.
			this.text_area.textContent += `Average speed: ${this.format(this.average_speed)}.\n`;
			this.text_area.textContent += `Total speed: ${this.format(this.total_speed)}.\n`;
		}

		handle_error(error, index)
		{
			if(error.type == "abort")
			{
				console.log("Segment abort:", index);
			}
			else
			{
				console.log("Segment error:", index, error);
			}
		}

		async move(index)
		{
			// Async wait playlist information.
			let playlist = await this.playlist;

			// Abort all xhr requests, because destruct xhr object not aborted request.
			this.segments.forEach((value, key) =>
			{
				// Propagate errors from rejected promises.
				value.promise.catch((error) => this.handle_error(error, key));

				// Abort request and reject linked promise.
				value.xhr.onabort = value.xhr.onerror;
				value.xhr.abort();
			});

			// Clear buffer.
			this.segments.clear();

			// Fill buffer.
			for(let i = index; this.segments.size < 6; i++)
			{
				this.segments.set(i, new AgressiveHls.Segment(this, playlist[i].url));
			}
		}

		async take(index)
		{
			// Log requested segment status.
			console.log(this.segments.has(index) ? "Segment hit:" : "Segment miss:", index);

			// Move buffer on miss.
			if(!this.segments.has(index)) await this.move(index);

			// Async wait playlist information.
			let playlist = await this.playlist;

			// Async wait requested segment.
			let result = await this.segments.get(index).promise;

			// Remove requested segment from buffer.
			this.segments.delete(index);

			// Predict and add next segment.
			let next_index = Math.max(... this.segments.keys()) + 1;
			this.segments.set(next_index, new AgressiveHls.Segment(this, playlist[next_index].url));

			// Return requested segment data.
			return result.target.response;
		}

		handle_events(hls)
		{
			this.playlist = new Promise((resolve, reject) =>
			{
				hls.on(Hls.Events.LEVEL_LOADED, (event, data) =>
				{
					resolve(data.details.fragments);
				});
			});
		}
	},

	Loader: class Loader extends Hls.DefaultConfig.loader
	{
		/** @type Buffer */
		buffer;

		constructor(config)
		{
			super(config);
			this.buffer = config.buffer;
		}

		async load(context, config, callbacks)
		{
			this.buffer.take(context.frag.sn).then
			(
				(buf) => callbacks.onSuccess({data: buf}, {}, context),
				(error) => { if(error.type != "abort") console.log("Segment error:", context.frag.sn, error); }
			);
		}

		abort()
		{
			// Api stub to supress errors and ignore "abort" events.
		}
	}
};
