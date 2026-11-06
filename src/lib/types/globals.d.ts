interface UserAgentData {
	platform: string;
}

interface BatteryManager extends EventTarget {
	level: number;
	charging: boolean;
}

interface BareMuxConnection {
	setTransport(path: string, options: Array<{ base: string; wisp: string }>): Promise<void>;
}

interface InjectedTransport {
	new (options: { wisp: string }): { init(): Promise<void> };
}

interface Window {
	BareMux: { BareMuxConnection: new (workerPath: string) => BareMuxConnection };
	EpoxyTransport: InjectedTransport & { default?: InjectedTransport };
	LibcurlTransport: InjectedTransport & {
		LibcurlClient?: InjectedTransport;
		default?: InjectedTransport;
	};
	$scramjetLoadController: () => {
		ScramjetController: new (options: Record<string, unknown>) => {
			init(): Promise<void>;
			encodeUrl(url: string): string;
		};
	};
	$scramjetController: {
		Controller: new (options: {
			serviceworker: ServiceWorker;
			transport: { init(): Promise<void> };
		}) => {
			createFrame(iframe: HTMLIFrameElement): { go(url: string): void };
			setTransport(transport: { init(): Promise<void> }): void;
			wait(): Promise<void>;
		};
		config: {
			scramjetPath: string;
			injectPath: string;
			wasmPath: string;
			codec: { encode(url: string): string; decode(url: string): string };
		};
	};
	__uv$config?: {
		prefix: string;
		encodeUrl(url: string): string;
		decodeUrl(url: string): string;
	};
	eruda?: { init(): void; show(): void };
}

interface Navigator {
	deviceMemory?: number;
	userAgentData?: UserAgentData;
	getBattery?: () => Promise<BatteryManager>;
}

declare module '@mercuryworkshop/epoxy-transport' {
	export const epoxyPath: string;
}
