import { buildApp } from "./app.js";
import { setIO } from "./ws/broadcast.js";
import { createSocketServer } from "./ws/index.js";

const app = buildApp();
const port = Number(process.env.PORT ?? 3001);

const start = async () => {
	try {
		await app.listen({ port, host: "0.0.0.0" });

		const httpServer = app.server;
		const io = createSocketServer(httpServer);
		setIO(io);

		app.log.info("Socket.IO attached to HTTP server");
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
};

void start();
