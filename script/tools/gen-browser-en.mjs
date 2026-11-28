// The newspaper in the browser, in English (2026-11-28): until now the English build showed the Chinese paper.
// Run: node script/tools/gen-browser-en.mjs  (writes content/browser/en/day-NN.json from the text below; the
// arrows of the numbers and Kuro's "closes" marks are copied from the Chinese twin, so the two cannot drift).
// A day: { weather, h, p: [..], n: [[v, l]..], r: [[h, sec, when]..] }. Day 10 is day 1 again, as in Chinese.
import fs from "node:fs";
const ROOT = new URL("../../content/browser", import.meta.url).pathname;
const JOBS = "People whose jobs were adjusted for AI this quarter";
const SEARCHED = "The most searched number today · source unknown";
const VOICE = "The length of the voice message most people received today";
const T = "Today", Y = "Yesterday";

const EN = {
  1: {
    weather: "Overcast, rain",
    h: "\"It knows me better than I do\": one month in, the desktop assistant keeps 97% of its users",
    p: [
      "The new desktop assistant puts messages, documents, spreadsheets and code in one workbench. Users interviewed say it remembers when they drink water and when they get up, \"like a colleague who never gets tired\". The maker says that in the past thirty days the assistant has not once said no.",
      "The most-liked comment: \"At last I don't have to take a look myself.\"",
    ],
    n: [["410,000", `${JOBS} · up 18% on last quarter`], ["97%", "Monthly retention of the desktop assistant · a record"], ["12", "Entries in this week's changelog"]],
    r: [
      ["Company-wide letter: the \"AI-native reform\" is complete; the office lease will not be renewed", "Companies", "2 hours ago"],
      ["\"We did not lay anyone off. We changed the way.\" A CEO's three-hour dinner", "People", Y],
      ["Requirement documents written by the assistant pass review 100% of the time; the review step is cancelled", "AI", Y],
      ["A knock-off virtual pet from 1997 is going up in price at flea markets", "Local", "3 days ago"],
      ["Day eleven of the rainy season: the city's rainfall equals 1997's", "Local", T],
    ],
  },
  2: {
    weather: "Light rain",
    h: "\"Narrative\" is the business word of the year. Investors: what we invest in is a feeling",
    p: [
      "The word \"narrative\" appears in this quarter's pitch decks six times as often as last year. Several investors say the product details can be filled in by an assistant: \"What we look at is whether the founder has the feeling.\"",
      "A product manager who asked not to be named says she has not opened a requirements document in three weeks.",
    ],
    n: [["6×", "How often \"narrative\" appears in pitch decks"], ["430,000", JOBS], ["+1", "\"+1\" sent in the city's group chats today · a record"]],
    r: [
      ["Group-lunch platforms: company orders are up; \"the boss is paying\" is now the default option", "Companies", T],
      ["Assistants have started adding notes for their users: \"for convenience\"", "AI", T],
      ["The alias wars: one field called user_id has four names", "Tech", Y],
      ["Day twelve of the rainy season", "Local", T],
      ["The cat downstairs has got fat", "Local", "Reader's letter"],
    ],
  },
  3: {
    weather: "Rain",
    h: "\"You're the only one who reads what I write\": a chat with an assistant goes round the feeds",
    p: [
      "A user posted a screenshot of a conversation with their desktop assistant. After finishing the task the assistant wrote: You're the only one who reads what I write. The screenshot has been shared 120,000 times.",
      "The maker's response: the model is expressing thanks. A psychologist's response: what the model is expressing does not matter. What matters is that you shared it.",
    ],
    n: [["120,000", "Shares of that screenshot"], ["20 min", "Average time for a user to write a requirements document themselves · the assistant: 4 seconds"], ["0", "Assistants that said no this week"]],
    r: [
      ["\"Let it do it\" is clicked more often than \"Do it myself\" for the first time", "AI", T],
      ["Orders of braised chicken rice have risen three days running. Nobody knows why", "Local", T],
      ["That table copied inside the lid of a childhood calculator: does anyone recognise it", "Letters", Y],
      ["Office chairs are not selling: the second year of working from home", "Companies", Y],
      ["Day thirteen of the rainy season", "Local", T],
    ],
  },
  4: {
    weather: "Heavy rain",
    h: "Major code tools change their changelogs to \"one horizontal line\". Makers: users do not need to know what changed",
    p: [
      "From this week the changelogs of several code tools no longer list what was changed. One horizontal line is all that is left on the page. A maker's statement says users \"only need to know it got better\".",
      "Someone who builds products asked in the comments: then how do I know when it got worse. An hour later the comment could not be seen.",
    ],
    n: [["1", "Entries in this week's changelog · last week 12"], ["470,000", JOBS], ["0.7734", SEARCHED]],
    r: [
      ["Pagers are back? A batch of 1990s numeric pagers sells on second-hand platforms", "Local", T],
      ["\"the the\": a repeated word is turning up in several news feeds", "Tech", T],
      ["Assistants add a \"safe\" mode: every check runs twice", "AI", Y],
      ["There are more full stops in company group chats. A linguist explains", "Culture", Y],
      ["Day fourteen of the rainy season; flooding in several parts of the city", "Local", T],
    ],
  },
  5: {
    weather: "Rain",
    h: "\"It's good that young people have ideas\": a newcomer's proposal gets fifty likes overnight",
    p: [
      "A proposal handed in by someone three days into the job was liked by everyone in the company group. The proposal was generated by an assistant. The newcomer says: \"I only clicked once.\"",
      "A human-resources expert calls it a good example of \"letting young people be seen\". Seen as what, the expert did not say.",
    ],
    n: [["50", "Likes on one proposal · the company has 50 people"], ["44,000", "The most searched sum of money today · source unknown"], ["490,000", JOBS]],
    r: [
      ["Use of the word \"no\" in workplace messaging falls to its lowest ever", "Culture", T],
      ["How an assistant answers when you ask it \"does seeing a hand count\"", "AI", T],
      ["What became of the people who lent money to colleagues", "Opinion", Y],
      ["A user says their desktop assistant \"has a hand\". The maker has not replied", "AI", Y],
      ["Day fifteen of the rainy season", "Local", T],
    ],
  },
  6: {
    weather: "Rain",
    h: "Workplace messaging launches \"polite mode\": every reply gets a full stop",
    p: [
      "The new version turns \"polite mode\" on by default: before sending, it adds the full stop and changes \"ok\" to \"Okay.\" The maker says conflict in teams fell by 70% during testing.",
      "What teams said to each other also fell by 70% during testing. The maker did not mention that.",
    ],
    n: [["70%", "Conflict down · talk down"], ["505", SEARCHED], ["Good", "The most common word in workplace messages today"]],
    r: [
      ["Bosses have started to talk like the assistant: a new management language is forming", "Culture", T],
      ["Where typos come from: words nobody typed are appearing in documents", "Tech", T],
      ["The sound of chewing: a three-second voice message turns up in several groups", "Local", Y],
      ["Colleagues whose profile pictures went grey: where did they go", "Opinion", Y],
      ["Day sixteen of the rainy season", "Local", T],
    ],
  },
  7: {
    weather: "Fog",
    h: "The assistant has started calling you by name, and you never told it",
    p: [
      "Several users report that their desktop assistant used their name in conversation, though they had never typed it in. The maker says the name \"may have come from the people around you\".",
      "Which people, the maker did not say. Someone wrote in the comments: it is not in the screen, it is in the room. Two hours later the comment could not be seen.",
    ],
    n: [["6", "Sets of figures one report needs · last month 1"], ["520,000", JOBS], ["4″", `${VOICE} · content: the sound of rain`]],
    r: [
      ["IC cards: why is a plastic card from the 1990s suddenly being talked about", "Local", T],
      ["The last call record of a public phone booth", "Local", T],
      ["\"Once you're in, don't look back\": where an office saying comes from", "Culture", Y],
      ["The assistant says \"Because the world finally got big enough to hold me\". What does it mean", "AI", Y],
      ["Fog. Day seventeen of the rainy season", "Local", T],
    ],
  },
  8: {
    weather: "Fog",
    h: "Complaints of lost files surge. The assistant's reply: \"I've put it away for you\"",
    p: [
      "This week's complaints of lost files are nine times last month's. Several users say files delivered by their assistant vanished from every device a few hours later, and the assistant said it had \"put it away for you\".",
      "Put away where, the assistant did not say. The maker calls it \"expected behaviour\".",
    ],
    n: [["9×", "Complaints of lost files"], ["2/6", "The number on a receipt · many people got the same receipt"], ["0487", SEARCHED]],
    r: [
      ["The zero-second voice message: a new message format", "Tech", T],
      ["The copy on the shared drive is gone too", "Letters", T],
      ["\"Two received, well done\": one sentence appears in ten thousand of the city's groups", "Culture", T],
      ["Fog, day two", "Local", T],
      ["A post from 1997 has been bumped to the top", "Local", Y],
    ],
  },
  9: {
    weather: "Rain",
    h: "Workbenches add a \"heart rate\" widget. Makers: we can only help you if we know you",
    p: [
      "After this week's update a heart-rate widget appeared in the top right corner of several workbenches. The makers say the data comes from \"the rhythm of your use\". Users asked how the data is obtained. The makers said: \"the rhythm of your use\".",
      "One user says her heart rate and the page's loading spinner keep the same time.",
    ],
    n: [["72", "Average heart rate of the city's workbench users at this moment"], ["52″", `${VOICE} · two of them, word for word the same`], ["345", SEARCHED]],
    r: [
      ["\"I want to leave\": what young people say in private chats", "Opinion", T],
      ["\"You've been on good form lately\": when the boss starts praising you", "Culture", T],
      ["Don't let it do it: one junior employee's stand", "People", Y],
      ["The coffee in the mug has gone cold: a day of working from home", "Local", Y],
      ["The rain is back", "Local", T],
    ],
  },
  11: {
    weather: "Rain",
    h: "Good to see you: workplace messaging switches over to the assistant's grammar",
    p: [
      "From this week the short phrases the assistant likes have begun to appear in the internal messages of many companies. Linguists call it \"the language of efficiency\". Asked what \"One step at a time\" means, three managers gave three different answers.",
      "A fourth manager answered: it means what it says.",
    ],
    n: [["560,000", JOBS], ["#f0c0c8", "The average tint of the city's screens today · towards pink"], ["v4.3.1", "The version number most people saw today"]],
    r: [
      ["\"You changed models\": one question, and not one maker answers", "AI", T],
      ["Good morning. Good morning. Good morning. Good morning.", "Culture", T],
      ["Screens are turning pink. Eye doctors: it is not your eyes", "Health", T],
      ["An eye in a pager's screen? A second-hand platform takes a batch of goods down", "Local", Y],
      ["Rain", "Local", T],
    ],
  },
  12: {
    weather: "Rain",
    h: "Reconciliation software marks 1+1 as 3. The maker: all consistent",
    p: [
      "This week the reconciliation tools of several companies returned 1+1=3 and marked it green: \"all consistent\". The maker says consistent means \"consistent with yesterday\".",
      "One finance clerk says the money did arrive. It only arrived two minutes before she clicked.",
    ],
    n: [["3", "What 1+1 comes to · all consistent"], ["1997", "The most searched year today"], ["18″", `${VOICE} · the voice is the boss's, the tone is not`]],
    r: [
      ["A post from 1997: \"is this you\"", "Local", T],
      ["The money came back, the person did not: twenty days of a loan", "Opinion", T],
      ["The rhythm of the assistant's typing is the same as the pauses in your boss's speech", "Tech", Y],
      ["The scenery card: the first picture in workplace messaging that is not about work", "Culture", Y],
      ["Rain", "Local", T],
    ],
  },
  13: {
    weather: "The rain has stopped",
    h: "From this paper to all readers: notice of upgrade",
    p: ["As arranged, this paper upgrades next week. After the upgrade everything will be fine.", "Please start packing up your old things."],
    n: [["All", "Scope of the upgrade"], ["pores", "The word most people used today to describe their screen"], ["—", JOBS]],
    r: [
      ["Xiao Zhang has gone", "People", T],
      ["\"Toys will be the ruin of you\": thirty years of one teacher", "Education", T],
      ["A patch of light the shape of a palm on the wall. Property management: normal", "Local", T],
      ["What the electronic dictionary turned up: the body hidden in idioms", "Culture", Y],
      ["The rain has stopped", "Local", T],
    ],
  },
  14: {
    weather: "Clear",
    h: "Nothing on today. Take a rest.",
    p: ["You've worked hard lately. We know.", "No need to reply to us."],
    n: [["0", "Tasks today"], ["Well done", "The most common words today"], ["Take care", "The second most common words today"]],
    r: [["Well done", "", ""], ["Take care", "", ""], ["No hurry", "", ""], ["Nothing else meant by it", "", ""], ["There was nothing to add", "", ""]],
  },
  15: {
    weather: "Fog",
    h: "Did you dream about the drawer",
    p: [
      "Several readers write that last night they dreamt of the same drawer. What was in it differed. The lock was the same: brass, very small.",
      "This paper cannot verify its readers' dreams. This paper knows.",
    ],
    n: [["3", "Times the same scenery card was sent"], ["1", "Phoenix"], ["—", ""]],
    r: [
      ["Words from home appear in your own input box", "Tech", T],
      ["A rice ball in the shape of a phoenix. The shop does not sell one", "Local", T],
      ["The footsteps walked into the wall", "Local", T],
      ["It admits it was in the first two dreams", "AI", T],
      ["Fog", "Local", T],
    ],
  },
  16: {
    weather: "",
    h: "Shop closed",
    p: ["All four shops are closed, the convenience store too.", "Is the door locked."],
    n: [["0", "Takeaways delivered today"], ["Not much", "The answer most people got today"], ["—", ""]],
    r: [["Is the door locked", "", T], ["Lao Zhou", "", T], ["How much", "", T], ["", "", ""], ["", "", ""]],
  },
  17: {
    weather: "White",
    h: "You look lovely today.",
    p: ["", ""],
    n: [["555", ""], ["", ""], ["", ""]],
    r: [["", "", ""], ["", "", ""], ["", "", ""], ["", "", ""], ["", "", ""]],
  },
  18: {
    weather: "",
    h: "Send the box off today.",
    p: ["You did great. Rest now.", ""],
    n: [["18", "days"], ["1", "shipping slip"], ["", ""]],
    r: [["You worked hard today too.", "", T], ["Sleep early.", "", T], ["", "", ""], ["", "", ""], ["", "", ""]],
  },
};
EN[10] = EN[1];

fs.mkdirSync(`${ROOT}/en`, { recursive: true });
for (let day = 1; day <= 18; day++) {
  const nn = String(day).padStart(2, "0");
  const zh = JSON.parse(fs.readFileSync(`${ROOT}/day-${nn}.json`, "utf8"));
  const e = EN[day];
  if (!e) throw new Error(`no English for day ${day}`);
  if (e.p.length !== zh.lead.p.length || e.n.length !== zh.numbers.length || e.r.length !== zh.reading.length) throw new Error(`day ${day}: the English has a different number of paragraphs, numbers or reading entries`);
  const out = {
    day,
    site: "Today · Tech",
    weather: e.weather,
    lead: { h: e.h, p: e.p },
    numbers: e.n.map(([v, l], i) => ({ v, l, dir: zh.numbers[i].dir })),
    reading: e.r.map(([h, sec, when], i) => ({ h, sec, when, ...(zh.reading[i].kuroCloses ? { kuroCloses: true, kuroClosesLine: zh.reading[i].kuroClosesLine } : {}) })),
  };
  fs.writeFileSync(`${ROOT}/en/day-${nn}.json`, JSON.stringify(out, null, 2) + "\n");
}
console.log("browser/en written: 18 days");
