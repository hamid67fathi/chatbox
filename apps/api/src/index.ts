import { buildApp } from "./app.js";
import { setIO } from "./ws/broadcast.js";
import { createSocketServer } from "./ws/index.js";

const app = buildApp();
const port = Number(process.env.PORT ?? 3001);

const start = async () => {
	try {
		await app.listen({ port, host: "0.0.0.0" });
		console.log(`Server listening at http://0.0.0.0:${port}`);

		const httpServer = app.server;
		const io = createSocketServer(httpServer);
		setIO(io);

		console.log("Socket.IO attached to HTTP server");
	} catch (err) {
		console.error("Failed to start server:", err);
		process.exit(1);
	}
};

void start();
