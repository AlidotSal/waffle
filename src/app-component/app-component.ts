import { Component } from "endorphin";
import { DataConnection, MediaConnection, Peer } from "peerjs";

interface AppComponentState {
	peer: Peer | null;
	calls: MediaStream[];
	incoming: MediaStream | null;
	localStream: MediaStream;
	isActive: boolean;
	mic: boolean;
}

export function state(): AppComponentState {
	return {
		peer: null,
		calls: [],
		incoming: null,
		localStream: null,
		isActive: false,
		mic: true,
	};
}

type AppComponent = Component<AppComponentState>;

export function didMount(component: AppComponent) {
	navigator.mediaDevices
		.getUserMedia({ video: false, audio: true })
		.then((stream) => component.setState({ localStream: stream }));
}

export function handleName(
	component: AppComponent,
	e: InputEvent,
	target: HTMLInputElement,
) {
	component.setState({ peer: new Peer(target.value) });

	component.state.peer.on("call", (c: MediaConnection) => {
		component.state.incoming = c;
		handleAnswer(component);
	});
	component.state.peer.on("connection", (conn: DataConnection) => {
		conn.on("data", (data: string) => {
			for (const p of data) {
				if (
					component.state.calls.some(
						(call) => p === call.peer || p === component.state.peer._id,
					)
				)
					continue;
				handleCall(p, component);
			}
			conn.close();
		});
	});
	component.state.peer.on("disconnected", () => {
		component.state.peer.reconnect();
	});
}

export function addSrc(el: HTMLAudioElement, stream: MediaStream) {
	el.srcObject = stream;
}

export function toggleMic(component: AppComponent) {
	component.setState({ mic: !component.state.mic });
	if (component.state.call) {
		component.state.localStream.getAudioTracks()[0].enabled =
			component.state.mic;
	}
}

export function handleCall(id: string, component: AppComponent) {
	const call = component.state.peer.call(
		id ?? "Ali",
		component.state.localStream,
	);
	call.on("stream", (stream: MediaStream) => {
		component.setState({
			calls: [...component.state.calls, { peer: call.peer, stream: stream }],
		});
	});
	component.setState({ isActive: true });
	call.on("close", () => {
		const i = component.state.calls.findIndex((el) => el.peer === call.peer);
		component.setState({
			calls: [
				...component.state.calls.slice(0, i),
				...component.state.calls.slice(i + 1),
			],
		});
	});
}

export function handleAnswer(component: AppComponent) {
	component.state.incoming.answer(component.state.localStream);
	component.state.incoming.on("stream", (stream: MediaStream) => {
		component.setState({
			calls: [
				...component.state.calls,
				{ peer: component.state.incoming.peer, stream: stream },
			],
		});
		component.setState({ incoming: null });
	});
	component.setState({ isActive: true });
	if (component.state.calls.length > 0) {
		let conn = component.state.peer.connect(component.state.incoming.peer);
		conn.on("open", () => {
			const peers = component.state.calls.map((c) => c.peer);
			conn.send(peers);
		});
		conn.on("close", () => {
			conn.close();
			conn = null;
		});
	}
	component.state.incoming.on("close", () => {
		const i = component.state.calls.findIndex(
			(el) => el.peer === component.state.incoming.peer,
		);
		component.setState({
			calls: [
				...component.state.calls.slice(0, i),
				...component.state.calls.slice(i + 1),
			],
		});
	});
}

export function handleHangUp(component: AppComponent) {
	component.state.peer.destroy();
	component.setState({ peer: null, calls: [] });
}
