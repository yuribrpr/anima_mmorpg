import { createApp } from "./app";
import { getEnv } from "./config/env";

const port = getEnv().PORT;
const app = createApp();

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
