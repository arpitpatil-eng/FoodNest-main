const app = require("./server");
const { queueLiveDbRefresh } = require("./utils/liveDbView");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Foodnest backend running on http://localhost:${PORT}`);
  queueLiveDbRefresh();
});

