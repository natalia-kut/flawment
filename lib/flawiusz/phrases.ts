// What Flawiusz shows while the model is working. Shared by the server (agent.ts)
// and the chat, which shows the first one before the server answers.
export const busyPhrases = [
  "Gnawing on it…",
  "Chewing it over…",
  "Building a dam of ideas…",
  "Paddling through the details…",
  "Stacking the logs…",
  "Whittling an answer…",
];

export function randomBusyPhrase() {
  return busyPhrases[Math.floor(Math.random() * busyPhrases.length)];
}

export const unavailableMessage = "Flawiusz is unavailable right now. Please try again later.";
