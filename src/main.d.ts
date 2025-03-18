import
{
	Fragment,
	FragmentLoaderConstructor,
	FragmentLoaderContext,
	HlsConfig,
	Loader,
	LoaderCallbacks,
	LoaderConfiguration,
	LoaderContext
} from "hls.js";

export declare namespace AgressiveHls
{
	const CustomLoaderBase: new (confg: HlsConfig) => Loader<FragmentLoaderContext>;

	export interface Config
	{
		connection_count?: number;
		retry_slow_connections?: "off" | "relative" | "fixed";
		advanced_segment_search?: boolean;
	}

	export class Segment
	{
		private buffer;
		private start_point;
		public url;
		public xhr: XMLHttpRequest;
		public speed: number;
		public speed_rel_avg: number;
		public speed_rel_avg_stat: "wait" | "good" | "bad";
		public progress: number;
		public requested: boolean;
		public loaded: boolean;
		public onload: (() => any) | null;

		public constructor(buffer: Buffer, url: string);
		public on_load();
		public on_progress(event: ProgressEvent<EventTarget>): void;
		public on_error(error: any): void;
		public abort(): void;
		public retry(): void;
		public copy_response(): ArrayBuffer;
	}

	export class Buffer
	{
		private segments;
		public playlist: Fragment[] | null;
		public on_stats_update: ((content: string) => void) | null;
		public speed_total: number;
		public speed_avg: number;
		public connection_count: number;
		public retry_slow_connections: boolean;
		public advanced_segment_search: boolean;

		public constructor(config?: Config);
		public on_progress(): void;
		public subscribe(index: number, callback: (buffer: ArrayBuffer) => void): void;
		public make_loader(): FragmentLoaderConstructor;
	}

	export class CustomLoader extends CustomLoaderBase
	{
		private buffer;

		public constructor(config: HlsConfig, buffer: Buffer);
		public load(context: FragmentLoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>): void;
		public abort(): void;
	}

	export {};
}
