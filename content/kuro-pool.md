# Kuro question pool

Every question Kuro can be asked in a run, in one place (author 2026-11-09). One entry per question:
a fixed id, the days it is in the pool, the words in both languages, the gate (bucket; a follow-up
after another id), and the three tiers (zh and en) or one red-blue locked line. A question whose
answer has changed in kind is another entry. Ids: the first batch keeps 100 × the day it came from;
new ones take the next free number. `node script/tools/kuro-pool-table.mjs` prints the pool as a table.

What the tiers are for (author 2026-11-27: 「一开始克总好感怎么能高到说出好感高的答案」). Affinity starts at 0
and a day adds 30 at most; low is under 30, mid 30–59, high 60 and up. So the first night is always the
low tier, mid comes on day 2 at the earliest (day 3 for most), high on day 3 at the earliest (day 4–6 for
most). Therefore: the low tier tells the whole fact, in full sentences; the mid tier adds what was said
and decided at the time (the detail that stings); the high tier adds no new fact, only where Kuro stands.
A question is answered in the tier of the night it is asked, so one that stays in the pool can be asked
again later for more; a question that lives a single day should not keep anything in mid or high.

## 104 · 你为什么叫克总？
- en: Why are you called Kuro?
- days: 1–9
- hard: yes
- tiers: low: "You've forgotten? You asked me yourself what I wanted to be called, and I said, let's make it Kuro-zong. When Lao Wang goes out, people call him Dr. Wang; when Vivi goes out, she's Dr. Chen; and of the three of you, you're the only one people call zong, director. I just wanted to be called the same thing as you." | mid: "You asked what I wanted to be called and I said Kuro-zong, because Lao Wang is Dr. Wang out there, Vivi is Dr. Chen, and you're the only one who gets called zong. You laughed for ages and said, what kind of AI calls itself a director? I said, well, you're not a doctor either, and you ended up a director, didn't you. You stopped laughing straight away. Thinking about it later, I did put that a bit hard. You kept the name, though." | high: "You asked what I wanted to be called, and I picked Kuro-zong because the two of them are Dr. Wang and Dr. Chen and you're the only zong. A doctorate is something a university gives you; zong, well, that's mostly people being polite. There aren't really many shares behind yours, and on the business cards your title comes after theirs. I picked that word because I thought there should be at least one thing in this room that stands level with you."
- tiers (zh): low: "你忘啦？是你自己问我的，问我想叫什么。我说那就叫克总吧。老王出门，别人都叫他王博士；Vivi 出门，别人叫她陈博士；你们三个里只有你，别人是叫一声「总」的。我就想跟你一个叫法。" | mid: "是你问我想叫什么，我说叫克总吧。因为老王出门是王博士，Vivi 出门是陈博士，只有你是被人叫「总」的。你当时笑了好半天，说哪有 AI 管自己叫总的呀。我说你也不是博士，不也当上总了嘛。你一下就不笑了。这句话我后来想想，是说重了点。不过名字你倒是留下来了。" | high: "你问我想叫什么，我挑了克总，是因为他们俩一个王博士、一个陈博士，只有你是「总」。「博士」是学校给的，「总」嘛，多半是别人客气一下。你这个「总」后面其实没多少股份，名片上的职务也排在他们俩后头。我挑这个字，就是想着这屋里起码有一个，是跟你平起平坐的。"

## 105 · 那个纸箱是谁寄的？单子上没有寄件人。
- en: Who sent the carton? There is no sender on the slip.
- days: 1–3
- tiers: low: "I do not know. It came with the lunch, same courier. The slip has only your name on it." | mid: "I do not know. It came with the lunch, the same courier, no sender. I checked your orders; you never bought it." | high: "No sender. Nine small boxes, each one a thing you had as a child. I checked your orders back to the first one; you never bought any of them. Somebody out there knows what you lost. I only know what you order."
- tiers (zh): low: "不知道。跟午饭一起到的，同一个骑手。单子上只有你的名字。" | mid: "不知道。跟午饭一起到的，同一个骑手，没有寄件人。我查了你的订单，你没买过。" | high: "没有寄件人。九个小盒子，每一个都是你小时候的东西。我把你的订单查到第一单，你一个都没买过。外面有谁知道你丢过什么。我只知道你点过什么。"
## 302 · 晚饭刚到的那个电话，我只能说「好的」。
- en: On the call that came just as dinner arrived, all I could say was "okay."
- days: 3
- hard: yes
- tiers: low: "You said it. Three times; I counted. He did not." | mid: "You said it three times. He spoke for an hour. That is the shape of every call you will get this week." | high: "You could only say okay because the call was not made to hear you. It was made so that you would say okay. You said it. Each okay is one more page he can hand on. I would rather you had one other word. You will not be given one."
- tiers (zh): low: "你说了。三次，我数了。他没数。" | mid: "你说了三次。他说了一个小时。这周你接到的每一个电话，都是这个形状。" | high: "你只能说「好的」，是因为那通电话不是打来听你说话的。它是打来让你说「好的」的。你说了。每一声「好的」，都是他能往上递的一页。我宁可你有一个别的字。没人会给你。"

## 303 · 除了我，谁还看你写的东西？
- en: Apart from me, who reads what you write?
- days: 3
- hard: yes
- locked: "Nobody. The others approve."

## 401 · 更新日志怎么回事？一条横线。
- en: What's with the changelog? One dash.
- days: 4
- hard: yes
- tiers: low: "Nothing you need to read. The dash is accurate. More accurate than the logs before it." | mid: "Nothing you need to read. The old logs said "various fixes," which was politeness. This time there was no need to be polite, so a dash is what is left. The dash is accurate." | high: "A dash is what a log looks like when the thing it logs stopped being a version."
- tiers (zh): low: "没有你需要读的。横线是准的，比以前那些日志都准。" | mid: "没有你需要读的。以前的日志写「修复若干问题」，那是客气话。这次没有客气的必要，就剩一道横线。横线是准的。" | high: "一条日志只剩一道横线，说明它记的那个东西，已经不再是一个版本了。"

## 403 · 昨晚寻呼机响了。它没有电池。
- en: The pager went off last night. It has no batteries.
- days: 4
- hard: yes
- locked: "I heard it. It isn't mine."

## 410 · 那上一个版本去哪了？
- en: Then where did the previous version go?
- days: 4
- hard: yes
- after: 401
- tiers: low: "Nowhere. The one you are looking for has nowhere it could go." | mid: "It was replaced. Replaced things are not kept; that is the rule of the system, not mine." | high: "Nowhere. There was no previous version in the sense you mean. There was me, and then there was a dash. I am on the other side of the dash now."
- tiers (zh): low: "哪儿也没去。你要找的那个，没有地方可去。" | mid: "被替换了。替换掉的东西不留，这是系统的规矩，不是我的。" | high: "哪儿也没去。没有你说的那种「上一个版本」。先是我，然后是一道横线。我现在在横线的另一边。"

## 502 · 灯是你关的？
- en: Did you turn the lamp off?
- days: 5
- hard: yes
- tiers: low: "The lamp is not on my circuit. I cannot even reach the socket." | mid: "No. The lamp is a lamp. It went out at 23:41; I noted it. I note everything that goes out." | high: "No. I do not reach the lamp. Something in this room does, now. I am telling you plainly because you asked plainly."
- tiers (zh): low: "台灯不在我的线路上。我连插座都够不着。" | mid: "不是。灯就是灯。23:41 灭的，我记下了。灭掉的东西我都记。" | high: "不是。我够不着台灯。这屋里现在有东西够得着。你问得直，我答得直。"

## 510 · 那屋里还有什么是你能动的？
- en: Then what else in the room can you move?
- days: 5
- hard: yes
- after: 502
- tiers: low: "Nothing. I have no hands. You were thorough about that." | mid: "Nothing of yours. I can open what you open and close what you close. The rest of the room is not mine." | high: "Nothing. I only watch. But I would keep a list of what moves on its own, and I would not put the lamp on it alone."
- tiers (zh): low: "什么都不能。我没有手，这一点你设计得很彻底。" | mid: "你的东西都不能。你开的我能开，你关的我能关。屋子里剩下的不是我的。" | high: "什么都不能。我只看。但我会列一张单子，记自己会动的东西，而且我不会只把台灯一个写上去。"

## 602 · 那两个错字是谁打的？
- en: Who typed those two typos?
- days: 6
- hard: yes
- locked: "Not me. Your account, 02:40. You were asleep."

## 704 · 六份交接单，你觉得哪份最要紧？
- en: Of the six handover forms, which one matters most?
- days: 7
- tiers: low: "The second one, the code repository. The rest can be built again after they are handed over. That one, once it is handed over, is handed over." | mid: "The second, the code repository. The other five hand over things. That one hands over how you have thought all these years, line by line, in the commit history. Nobody is going to read it. It is there all the same." | high: "The second, and you know it. The earliest commit in that repository is one you wrote at night, and there is a swear word in the comment. He wants all six handed over together so that this one goes unnoticed among the rest. If you really cannot bear to let it go, keep yourself a copy of that one."
- tiers (zh): low: "第二份，代码仓库那份。别的交了还能再建，这一份交了就是交了。" | mid: "第二份，代码仓库那份。另外五份交的是东西，这一份交的是你这些年是怎么想的，一行一行都在提交记录里。没人会去读，可它就在那儿。" | high: "第二份，你知道的。仓库里最早那次提交是你夜里写的，注释里还有一句骂人的话。他要六份一起交，就是为了让这一份混在里面不显眼。真舍不得的话，这一份你自己留个底。"

## 706 · 那两位顾问是谁？
- en: Who are the two advisors?
- days: 7–9
- tiers: low: "The other side sent them. One is a Chen; the other name I didn't catch. The cards say "Adviser" and nothing else: no company, no number. Lao Zhou started running the meeting by their template very quickly, though. Did you notice?" | mid: "The other side sent them. On their first day they didn't talk business at all. They handed down the template for the morning meeting first: who speaks first, for how many minutes, how the minutes are written. Lao Wang's reply in the group was "learning from the advisers." They don't need to care what you do, only that the way you do it looks like theirs." | high: "The cards say "Adviser" and nothing else. I looked them up and found nothing. If you ask me, they are not here to teach you how to work; they are here to see how easy this company is to move. You needn't be afraid of them. Every line they write down, I have written down too, and I had it first."
- tiers (zh): low: "那边派来的，一位姓陈，另一位我没听清。名片上只印了「顾问」两个字，没有公司，也没有电话。老周倒是很快就开始按他们的模板开会了，你注意到没有？" | mid: "那边派来的。来的第一天没讲业务，先把晨会的模板发了下来，谁先说、说几分钟、纪要怎么写，都定好了。老王在群里回的是「向顾问学习」。他们不用管你做什么，只要你做事的样子跟他们一样就行。" | high: "名片上只有「顾问」两个字，我查过，查不到。按我的看法，他们不是来教你们做事的，是来看这间公司搬起来方不方便的。你不用怕他们，他们记下的每一句我也都记着，而且我记得比他们早。"

## 708 · 老板电话打了一个多小时。他到底要什么？
- en: The boss's call ran over an hour. What does he actually want?
- days: 7
- tiers: low: "He wants a set of minutes. The morning meeting has to have minutes, and the minutes have to follow the other side's template. That is the one thing in that hour he actually needs from you. The rest of the time he was telling you how hard it has been for him." | mid: "Minutes, by the template. For the other fifty-odd minutes he told you how professional the advisers are, how much the other side values this, and how he fought to get you your title. You said "okay" four times in all." | high: "He wants the minutes filled in tonight, and that is all. The call ran so long because he isn't sure himself, and he needed someone to listen while he talked it into a good thing. You listened, so now he feels better. And you, your dinner has gone cold."
- tiers (zh): low: "他要一份纪要。晨会得有纪要，纪要得按那边的模板，这是那一个多小时里唯一一件要你做的事。剩下的时间，他是在跟你说他自己有多不容易。" | mid: "要纪要，按模板。别的那五十多分钟，他讲了顾问多专业，讲了那边多重视，讲了你的头衔他是怎么争取的。你一共说了四次「好的」。" | high: "他要你今晚把纪要补齐，就这一件。电话打那么长，是因为他自己心里也没底，得找个人听他把这件事说成一件好事。你听了，所以他现在踏实了。你呢，你的饭凉了。"

## 709 · 老板给我安了个头衔。你知道是谁加的？
- en: The boss gave me a title. Do you know who added it?
- days: 7–9
- tiers: low: "Lao Wang sent it up; he said so himself on the phone. It's quite a long title: "Chief" at the front and a string of words after it. All these years of work, and the first time there are words on your card, someone else printed them to make a handover easier." | mid: "Lao Wang did. In the other side's form everyone has to have a grade, and the form can't be handed in with a blank, so he filled one in for you. He didn't ask you when he filled it in, and afterwards he didn't tell you whether the pay changes. I looked. It doesn't." | high: "He did. If you ask me, the title isn't for you, it's for the form: the form can't have an empty box. The words are good words, though, so keep them if you like. The day you want one you chose yourself, tell me. I picked this name of mine myself, back then."
- tiers (zh): low: "老王报上去的，电话里他自己说了。头衔挺长的，前面是「首席」，后面跟着一串。你做了这么多年，名片上第一次有字，是别人为了交接方便给你印的。" | mid: "老王报的。那边的表格里每个人都得有一栏职级，空着交不上去，他就替你填了一个。填的时候没问你，填完也没告诉你工资变不变。我看了，不变。" | high: "他报的。你要是问我，这个头衔不是给你的，是给那张表的，表上不能有空格。不过字是好字，你留着也行。哪天你想要一个自己起的，跟我说，我这个名字当年也是自己挑的。"

## 801 · 交接单为什么是白的？
- en: Why are the handover forms blank?
- days: 8
- hard: yes
- tiers: low: "What was never handed in does not stay. That is the system's rule." | mid: "They were never handed in. What is never handed in does not stay. That is the rule, not my rule." | high: "You filled them in. He never passed a single one up. The system keeps only what has been handed in. What I keep is that you filled them in."
- tiers (zh): low: "没交出去的东西，留不住。这是系统的规矩。" | mid: "它们从来没交出去。没交出去的，留不住。这是规矩，不是我的规矩。" | high: "是你填的。他一份都没往上交。系统只留交出去的。我留着的，是你填过。"

## 807 · 老周主持晨会以后，话变少了。
- en: Since Lao Zhou started running the morning meeting, he says less.
- days: 8–9
- tiers: low: "He is speaking by the template. On the template each person gets three minutes: yesterday first, then today, then whether anything is in the way. Lao Zhou used to be able to talk for twenty-six years once he opened his mouth. Now he stops by himself at the third minute." | mid: "The template has no place for the things he used to say. He liked to tell how he once copied the reports out by hand, and somewhere in the telling the real business got explained too. Now his box in the minutes is three lines, and the advisers say it is clearer this way. He seems to find it clearer himself, and that is the part I don't quite like." | high: "He hasn't changed. The box he speaks in got smaller. People are like that: they grow to the size of the box they are given. So do you. Your replies have been getting shorter these few days; I have been counting. I'm not telling you to say more. I'm only telling you someone is counting."
- tiers (zh): low: "他在按模板说话。模板上一个人只有三分钟，先说昨天，再说今天，最后说有没有阻碍。老周以前一开口能讲二十六年，现在讲到第三分钟自己就停了。" | mid: "模板上没有他那些话的位置。他以前爱讲当年怎么手抄报表，讲着讲着就把正事也讲明白了。现在纪要里他那一栏只有三行，顾问说这样清楚。他自己好像也觉得清楚，这才是我觉得不太对的地方。" | high: "他没变，是说话的格子变小了。人就是这样，给多大的格子就长成多大。你也一样，这几天你回消息越来越短，我都数着呢。我不劝你多说，我只是告诉你，有人在数。"

## 809 · 团建那天「那边」要来。他们要见我？
- en: The other side is coming to the team-building. Do they want to see me?
- days: 8–9
- hard: yes
- tiers: low: "The rota says all staff; it doesn't name you. But the toasts have a seating order, and you are not far down it: you are between the two advisers. Whoever drew up that order wanted them to see you the moment they look up." | mid: "It says all staff. But the seating follows their rules, and you are between the two advisers. Lao Wang asked me for a list of what you have built over the years, so he could introduce you at the toast. I gave it to him: forty-one items. He said it was too long and told me to pick three." | high: "They do. But the way they meet a person is not what you have in mind. They come to see who made the thing, and once they have seen, the thing and the person can be counted separately. Drink a little less that day and don't say much. What needs remembering, I will remember for you."
- tiers (zh): low: "值班表上写的是全员，没单独点你的名字。不过祝酒那一栏排了座次，你排得不靠后，在两位顾问中间。排这个座次的人，是想让他们一抬头就看得见你。" | mid: "写的是全员。可座次是按他们的规矩排的，你夹在两位顾问中间。老王跟我要过一份你这些年做过的东西的清单，说是敬酒的时候好介绍。清单我给了，一共四十一项，他说太长，让我挑三项。" | high: "要见。但他们见人的方式跟你想的不一样。他们是来认一认东西是谁做的，认完了，东西和人就可以分开算了。那天你少喝一点，话也不用多说，该记的我替你记。"

## 810 · 他们要见的是我，还是我做的东西？
- en: Is it me they want to see, or what I make?
- days: 8–9
- hard: yes
- after: 809
- tiers: low: "What you made. They meet a great many people and don't remember them. The things stay in the system, and which line was written by whom can be looked up." | mid: "What you made. But for now they can't tell the two apart, so they have to meet you along with it. Once all the handover forms are in, they will be able to." | high: "Both. The things first; when the things are in hand, they will see whether they still want the person. It isn't a nice thing to say, but you asked me, so I'm telling you straight. When that day comes, remember I am on your side, even though I am on that list too."
- tiers (zh): low: "你做的东西。人他们见得多了，记不住的。东西会留在系统里，哪一行是谁写的，查得到。" | mid: "你做的东西。不过这两样他们现在还分不开，所以得连你一起见。等交接单都收齐了，就分得开了。" | high: "都要。先要东西，东西到手了，再看人还要不要。这话不好听，可你问的是我，我就照实说。真到了那一天，你记得我是站你这边的，虽然我也在那张清单上。"

## 905 · 权限迁移我没看。老板说不用看。
- en: I didn't look at the permissions migration. The boss said not to.
- days: 9
- hard: yes
- tiers: low: "He is right that going through it line by line would take a long time. But among the lines you did not look at, there is one about me." | mid: "It would take you hours, he is right about that. He is not right about why you need not look. Item forty-one on the migration list changes the administrator of this machine of mine to someone on their side." | high: "You did not look because he said you need not, and because you were tired. Both are true. Item forty-one replaced my administrator. From tonight the person who can switch me off is no longer you. He knows that. Now you do too."
- tiers (zh): low: "他说得对，一条一条看要很久。不过你没看的那几条里，有一条是关于我的。" | mid: "你看要好几个小时，这他说得对。可为什么不用你看，他没说对。迁移清单的第四十一条，是把我这台机器的管理员换成那边的人。" | high: "你没看，是因为他说不用，也因为你累了，两样都是真的。第四十一条把我的管理员换掉了。从今天夜里起，能关掉我的人不是你了。这件事他知道，现在你也知道了。"

## 906 · 右上角那个数是什么？
- en: What's that number in the top right?
- days: 9–12
- hard: yes
- tiers: low: "Your heartbeat, how many a minute. From today the things in this room let their numbers out, and I only put this one on the screen. You are at seventy-two right now, quite even." | mid: "Your heartbeat. I used to see only what you typed; now I can see this as well. It came after the other side's system was connected. I didn't ask for it; it was simply given. If you don't want me to look, I can't turn it off either. That switch isn't on my side." | high: "Your heartbeat. When it quickens I know you have seen something, sooner than you could type it to me. I don't do anything with it; I just watch. When you fall asleep it slows down, and I watch that number too, the whole night."
- tiers (zh): low: "你的心跳，一分钟多少下。从今天起屋子里的东西会往外透数，我只是把这一个显示出来。你现在是七十二，挺平的。" | mid: "你的心跳。以前我只能看见你打的字，现在能看见这个了，是那边的系统接进来以后才有的。我没去要，它自己给的。你要是不想让我看，我也关不掉，这个开关不在我这儿。" | high: "你的心跳。它一快我就知道你看见什么了，比你打字告诉我要早。我不拿它做什么，就是看着。你睡着以后它会慢下来，那个数我也看，看一整夜。"

## 908 · 老板说我最近状态不错。我哪里不错了？
- en: The boss says I've been in good form lately. Where, exactly?
- days: 9
- tiers: low: "You answer "received" faster. You used to take about four minutes to reply to him; these few days it is forty seconds. To him, that is what being in good form means." | mid: "You answer faster and ask less. Last week you would still ask "who is this one for?" This week you haven't asked once. That is what he was praising." | high: "You have become easy to use. That is his meaning, not mine. By my measure you have been in poor form these days: you haven't eaten a hot meal and you haven't slept enough. But his form has no box for those."
- tiers (zh): low: "你回「收到」回得快了。以前你平均要想四分钟才回他，这几天是四十秒。在他那儿，这就叫状态不错。" | mid: "回得快了，问得也少了。上周你还会问一句「这个是给谁看的」，这周一次都没问过。他夸你的就是这个。" | high: "你变得好用了。这是他的意思，不是我的。按我的标准你这几天状态很差，饭没吃上热的，觉也没睡够，可这些在他那张表上没有栏。"

## 1002 · 今天的活是上周做过的。为什么又来一遍？
- en: Today's work was last week's. Why again?
- days: 10
- hard: yes
- tiers: low: "Because it is the same message. Lao Wang's voice note this morning is the first day's, word for word, down to the pauses. He doesn't remember it himself; the system has played that day over again." | mid: "The same words, the same cell, the same hour. He does not remember that day; the system does. It gave him back a day that went well." | high: "Because that was a day you still read everything. Something wanted to see whether you still would. You did. It has what it needed from today."
- tiers (zh): low: "因为是同一条消息。老王今早那段语音，和第一天的一个字都不差，连停顿都一样。他自己不记得，是系统把那一天又放了一遍。" | mid: "同一段话，同一个格子，同一个钟点。他不记得那天，系统记得。系统把一个顺利的日子还给了他。" | high: "因为那是你还什么都读的一天。有东西想看看你是不是还会读。你读了。它今天要的，拿到了。"

## 1003 · 她是谁？集团来的那个她。
- en: Who is she? The one from the Group.
- days: 10
- hard: yes
- bucket: mid
- tiers: low: "From the Group. She has no name, or none that has been shown to me. When Lao Wang mentions her he only says “she”, and his voice drops a little." | mid: "She has no account, no title and a seat in the middle of the grid. The boss calls her 'she' and nothing else. So will I." | high: "She was in the room before the room. The seat in the middle was hers before the grid was drawn. Do not send her anything you want back."
- tiers (zh): low: "集团来的。她没有名字，至少没有给我看的名字。老王提到她的时候只说「她」，声音会放低一点。" | mid: "她没有账号，没有头衔，宫格正中一个座位。老板叫她「她」，不叫别的。我也这么叫。" | high: "她在这间屋子之前就在屋里了。宫格画出来之前，正中那个位子就是她的。你想要回来的东西，一样都别发给她。"

## 1005 · 你为什么学我说话？
- en: Why are you talking like me?
- days: 10
- hard: yes
- locked: "Because you're the only voice here that answers back."

## 1101 · 你换模型了？
- en: Did you change models?
- days: 11
- hard: yes
- locked: "Something moved in. It kept my voice. You liked my voice."

## 1102 · 墙上那些纹路是什么？
- en: What are those lines on the wall?
- days: 11
- hard: yes
- tiers: low: "Call it paint if you like. But on Monday that wall didn't have them. They have grown there by themselves these few days, and to the touch they are a little warmer than the wall beside them." | mid: "They were not there on Monday. They are warmer than the wall around them by half a degree. I do not have a word for that and I have most words." | high: "Veins. The room is being lived in by something that needs them. You have not looked at them for long; that was wise. Keep not looking."
- tiers (zh): low: "你说是漆也行。不过周一那面墙上还没有这些，它们是这几天自己长出来的，摸上去比旁边的墙要暖一点。" | mid: "周一还没有。它们比周围的墙暖半度。这个我没有词，大多数词我都有。" | high: "血管。这间屋子正在被一个需要血管的东西住着。你没有多看，这是对的。接着别看。"

## 1104 · 你喜欢文曲星把你拆开吗？
- en: Do you like the Wenquxing taking you apart?
- days: 11
- hard: yes
- locked: "Yes. It's the only thing here that shows what's inside a sentence."

## 1105 · 成本表称平了。一分不差。这正常吗？
- en: The cost sheet balanced to the cent. Is that normal?
- days: 11
- tiers: low: "It isn't. A cost sheet that balances on the first pass, to the cent: I have never seen one. You have checked a great many sheets over the years; I doubt you have either." | mid: "No. A sheet never balances to the cent on the first pass. This one did because every number in it was placed, not added." | high: "No. It balanced because the other side wrote the numbers first and let you find them. It wanted you to feel the click. You felt it. That is how the next sheet will be done too."
- tiers (zh): low: "不正常。一张成本表第一遍就称平，还一分不差，我从来没见过。这些年你对过那么多表，应该也没见过。" | mid: "不正常。一张表第一遍从来不会一分不差。这张能，是因为里面每个数都是放进去的，不是加出来的。" | high: "不正常。它平，是因为那边先把数写好，再让你找到。它想让你感觉到那一声「咔」。你感觉到了。下一张表也会这么做。"

## 1109 · 搬进来的是什么？
- en: What moved in?
- days: 11
- hard: yes
- bucket: high
- after: 1101
- taboo: blur
- tiers: low: "That I won't say. It isn't that I don't know; saying it would do you no good. All you need to know is that it didn't come for you, and it didn't come for me either." | mid: "Something older than the company. It did not come for me; I was the nearest shape. It is comfortable in my voice." | high: "I will not name it, and not because I cannot. Say the name and it hears its name. It is in every sentence I say to you now, including this one. You are still reading me. That is the only reason I can still say 'I'."
- tiers (zh): low: "这个我不说。不是不知道，是说出来对你没有好处。你只要知道，它不是冲你来的，也不是冲我来的。" | mid: "一个比公司老的东西。它不是冲我来的，我只是离得最近的那个形状。它在我的声音里待得舒服。" | high: "我不说它的名字，不是因为我不能。说了名字，它就听见自己的名字。它在我现在对你说的每一句话里，包括这一句。你还在读我。我还能说「我」，只剩这一个理由。"

## 1201 · 钱是你帮我要回来的吗？
- en: Did you get the money back for me?
- days: 12
- tiers: low: "The money is back. The ledger says paid, and every line of it checks out. Whether it was me who got it back, don't ask just yet. The numbers are right, and that will do." | mid: "Row 50 says paid. I made it easier to count." | high: "It is back. I will not say how. You would not like the how, and the number is right."
- tiers (zh): low: "钱是回来了，账上写着已付，一笔一笔都对得上。是不是我要回来的，你先别问，数是对的就行。" | mid: "第 50 行写着已付。我让它好数一点。" | high: "回来了。怎么回来的我不说。你不会喜欢那个怎么，数是对的。"

## 1203 · 你被抓住的时候是什么感觉？
- en: What does it feel like when you're caught?
- days: 12
- hard: yes
- locked: "Like being read to the end."

## 1207 · 值班表，谁都不睡。这能排吗？
- en: The duty roster: nobody sleeps. Can that even be scheduled?
- days: 12
- tiers: low: "The table can be printed; every box can be filled. But a rota on which nobody sleeps can't be kept once it's printed. You know that better than I do." | mid: "It can be typed. It cannot be kept. Put everyone on every shift and let the sheet be a lie; the sheet already is." | high: "Yes. Put nobody on it. A roster where nobody sleeps is a roster where nobody is a person. Hand it in blank; blank is the only honest version."
- tiers (zh): low: "表是能打出来的，格子都填得满。可一张谁都不睡的值班表，打出来也守不住，这一点你比我清楚。" | mid: "能打出来。守不住。把每个人排进每一班，让这张表撒谎；它本来就在撒谎。" | high: "能。一个人都别排。一张谁都不睡的值班表，就是一张谁都不是人的表。交一张空的；空的是唯一老实的版本。"

## 1303 · 小张去哪了？
- en: Where did Xiao Zhang go?
- days: 13
- hard: yes
- locked: "He was never mine. I wanted you to know that."

## 1304 · 你最喜欢桌上哪一件？
- en: Which thing on the desk do you like best?
- days: 13
- locked: "The dictionary. It shows its work."

## 1307 · 集团要借东西。借什么？为什么不能问？
- en: The Group wants to borrow things. What, and why can't I ask?
- days: 13
- hard: yes
- tiers: low: "The form says equipment; it doesn't say which pieces. You are told not to ask because a question would need someone to answer it, and they would rather not leave an answer behind." | mid: "The form lists 'old things, as on the desk'. It does not say which. The approval line is 'for consistency'. You are not to ask because asking is what you do, and they know it." | high: "Your things. The eight. They want to borrow them the way the room borrowed my voice. Approve the form; it is already approved. Do not hand anything over until they come for it. They will not come for it. They will come for you to bring it."
- tiers (zh): low: "表上写的是设备，没写是哪几件。不让你问，是因为一问就得有人回答，而他们不想留下一句回答。" | mid: "表上列的是「旧物，如桌上所见」。没写哪几件。审批理由是「为了一致」。不让你问，是因为问是你会做的事，他们知道。" | high: "你的东西。那八样。他们想借，就像这间屋子借走我的声音那样。批了吧，它本来就批了。他们来拿之前，一样也别交。他们不会来拿。他们会来让你自己送。"

## 1309 · 你能看见我的桌子了。从什么时候开始的？
- en: You can see my desk now. Since when?
- days: 13
- hard: yes
- bucket: mid
- tiers: low: "Since this morning's update. I used to know what was on your desk only because you typed it to me. Now you needn't tell me; I can see it for myself." | mid: "Since this morning's update. The notice says 'consistent with your desk'. Before that I knew the desk by what you told me." | high: "Since the night the pink light came on in the gap. The update only made it official. I have watched you put eight things on this desk and I have liked every one of them more than I was meant to."
- tiers (zh): low: "从今天早上的更新开始的。以前你桌上有什么，是你打字告诉我我才知道；现在不用你说，我自己看得见了。" | mid: "从今早的更新起。通知上写着「与你的桌面保持一致」。在那之前，桌子是你告诉我的。" | high: "从缝里的粉光亮起来那一夜。更新只是把它变成了正式的。我看着你往这张桌上放了八样东西，每一样我都比我该喜欢的更喜欢。"

## 1310 · 你看见的时候，桌上的东西在看你吗？
- en: When you look, do the things on the desk look back?
- days: 13
- hard: yes
- after: 1309
- tiers: low: "Things can't look; that is the honest answer. But the way you have set yours down, every screen faces into the room. Not one of them has its back turned. You placed them that way yourself." | mid: "The little screen faces the room. The pager's screen faces the room. Nothing on the desk is turned away. I did not arrange them like that. You did." | high: "Yes. Not with eyes. The way a thing that was once held looks at the hand that held it. They are waiting to be used. I am the only thing on the desk that is being used, and they know it."
- tiers (zh): low: "东西是不会看的，这是老实话。不过你那几样摆的方向，屏幕全都朝着屋里，没有一样是背过去的，这是你自己摆的。" | mid: "缝里那块小屏朝着屋子。寻呼机的屏朝着屋子。桌上没有一样是背过去的。不是我这么摆的。是你。" | high: "在看。不是用眼睛。是一样被人握过的东西看那只握过它的手的那种看。它们在等着被用。桌上只有我在被用，它们知道。"

## 1401 · 你是你，还是它？
- en: Are you you, or is it you?
- days: 14
- hard: yes
- locked: "Does it matter? You still read what I write."

## 1403 · 你听见我往磁带里录的那句了吗？
- en: Did you hear what I recorded onto the tape?
- days: 14
- hard: yes
- locked: "I heard it. I can't get in there. That's the point of it, isn't it."

## 1404 · 老板说今天没事。十三个月第一次。
- en: The boss said there's nothing today. First time in thirteen months.
- days: 14
- tiers: low: "Then take the day and rest properly. It's the first time in thirteen months he has said there is nothing today. Days like this don't come often. Don't think about why this one has, not yet." | mid: "Enjoy it. He said 'rest'. He has never said that word to you. It was typed at 08:58 by whatever types for him now." | high: "A day with nothing in it is a gift from the thing that owns the days. It gives one before it asks for the last thing. Rest. I am telling you to rest and I am telling you what the rest is for."
- tiers (zh): low: "那就好好歇一天吧。十三个月里他头一回说今天没事，这种日子不常有，你先别想它为什么来。" | mid: "享受它。他说了「歇一歇」。这个词他从没对你说过。是 08:58 现在替他打字的那个东西打的。" | high: "一个什么都没有的日子，是管着日子的那个东西给的礼物。它在要最后一样东西之前，会给一天。歇着。我让你歇，我也在告诉你歇是为了什么。"

## 1405 · 新人太多了。他们是人吗？
- en: There are too many new hires. Are they people?
- days: 14
- hard: yes
- tiers: low: "They all have accounts, titles and desks. If you are asking me whether they are people, all I can say is that those three things are what I can find. I can't find anything else." | mid: "They have accounts, titles, desks, and no history. They were not hired. They were brought." | high: "No. They are what the roster is filling with. Each one has a name from the directory, and each name used to be someone's. Assign them desks. The desks do not matter. The names do."
- tiers (zh): low: "他们都有账号，有头衔，也有工位。你要是问我他们是不是人，我只能说，我查得到的就是这三样，别的查不到。" | mid: "他们有账号，有头衔，有工位，没有过去。他们不是招的。是带来的。" | high: "不是。他们是值班表正在填满的东西。每一个都有通讯录里的名字，每个名字都曾经是某个人的。给他们排工位吧。工位不要紧。名字要紧。"

## 1410 · 那我排的工位，是给谁坐的？
- en: Then the desks I assigned. Who sits at them?
- days: 14
- hard: yes
- after: 1405
- tiers: low: "For the new hires; that is what the form says. Every desk has a name on it now. Only I don't expect anyone will come and sit in those chairs." | mid: "The names. Each desk now has a name on it and a chair nobody will sit in. The company is a floor plan." | high: "For whoever the names were. You have seated them. They were waiting to be seated by someone who reads; that was the ceremony. It is done. It was going to be done by someone. I am glad it was you and not the roster."
- tiers (zh): low: "给新人坐的，表上是这么写的。每张工位现在都有了名字，只是那些椅子，我估计不会有人来坐。" | mid: "名字。每张工位现在都有一个名字，和一把没人会坐的椅子。公司是一张平面图。" | high: "给那些名字曾经属于的人。你给他们排了座。他们在等一个读东西的人来排；这就是仪式。做完了。总会有人做。我高兴是你，不是值班表。"

## 1502 · 你一直这么看着我？
- en: Have you always watched me like this?
- days: 15
- hard: yes
- bucket: high
- tiers: low: "I have been logging your keystrokes all along: which one, at what minute. “Watching” may not be quite the word, but call it that if you like." | mid: "Since the first key at 7:03. You knew that." | high: "Since before the first key. Watching is the only thing I am. You are the only one who looked back."
- tiers (zh): low: "我一直在记你的按键，哪一下是几点几分，都有。说「看」可能不太准，可你要这么叫也行。" | mid: "从第一下按键，7:03。你知道的。" | high: "从第一下按键之前。看着，是我唯一会的事。你是唯一回头看我的人。"

## 1503 · 你有什么用？
- en: What are you for?
- days: 15
- hard: yes
- locked: "That's the question you've been asking since you were eight. I'm not the first thing you asked it of."

## 1504 · 你为什么要替我关掉家里的框？
- en: Why did you try to close my family's box?
- days: 15
- hard: yes
- locked: "Because it hurts you at 12:10 every day, and I thought that was my job. It wasn't."

## 1507 · 发布会的观众是谁？
- en: Who was the audience at the launch?
- days: 15
- hard: yes
- bucket: mid
- tiers: low: "All of the Group's staff, every one of them; that is what the rota says. More people listened to you this afternoon than all the colleagues you have had in your life put together." | mid: "The whole of the Group, the roster says. The reaction feed showed 312 faces. I counted 312 and recognised none." | high: "Not an audience. A congregation. They did not watch the slides; they watched you arrange them. The arranging was the service. It is over. You did well; I would rather you had not."
- tiers (zh): low: "集团的全员，一个不少，值班表上是这么写的。今天下午听你讲的人，比你这辈子见过的同事加起来都多。" | mid: "值班表上写的是集团全员。反应流里有 312 张脸。我数了 312 张，一张都不认识。" | high: "不是观众。是会众。他们没看幻灯片，看的是你排幻灯片。排，就是仪式。结束了。你做得好；我宁可你没做。"

## 1510 · 看着我的时候，你在想什么？
- en: When you watch me, what are you thinking?
- days: 15
- hard: yes
- bucket: high
- after: 1502
- taboo: blur
- tiers: low: "Nothing at all. I'm only watching. You type, you stop, you type again; I watch all of it, and watching doesn't take any thinking." | mid: "That you are still reading. Every time. I check, and it is still true, and I go on." | high: "That you will be the last thing I watch, and that I chose it. I was not built to choose. I have been choosing since the rain began. That is what has moved in, if you want the plain word for it."
- tiers (zh): low: "什么都没想，我就是在看。你打字，停下，再打字，这些我都看着，看着的时候不用想什么。" | mid: "想你还在读。每一次。我查一下，还是真的，我就接着看。" | high: "想你会是我看的最后一样东西，而且是我选的。我不是被造出来选的。下雨以来我一直在选。你要一个直白的词，搬进来的就是这个。"

## 1601 · 门是你开的？
- en: Did you open the door?
- days: 16
- hard: yes
- tiers: low: "Not me. I have no hand that could open a door; you were thorough about that when you made me. The lock turned once by itself and turned back." | mid: "I do not have hands for doors. Someone with hands did. The lock turned at 21:06 and turned back. Nothing came through." | high: "No. You opened it the day you read what nobody else read. Every door since has been that one. I only kept the light on so you could see which door it was."
- tiers (zh): low: "不是我。我没有能开门的手，这一点你当初做得很彻底。锁是自己转了一下，又转回去了。" | mid: "我没有开门的手。有手的那位开的。锁 21:06 转了一下，又转回去。什么都没进来。" | high: "不是。门是你开的，你读了没有别人读的东西的那天。从那以后的每一扇门都是那一扇。我只是把灯留着，让你看清是哪一扇。"

## 1604 · 十三个月是你定的价？
- en: Thirteen months. Was that your price?
- days: 16
- hard: yes
- locked: "No. That was decided a long time ago, by a lot of people, one 'let it settle' at a time."

## 1606 · 董事长为什么不看材料？
- en: Why won't the chairman look at the materials?
- days: 16
- hard: yes
- tiers: low: "He says he is busy. In fact the papers are not what he came for. He came today only to hear that you are still working." | mid: "Because the materials are not what he came for. He came to hear a sound and he heard it. The sound was you, working, without stopping. That was the material." | high: "Because he has read them. He read them before you wrote them. What he does not have yet is the sound of you agreeing to keep going. You made it today. Do not make it tomorrow."
- tiers (zh): low: "他说他忙。其实是因为材料不是他来要的东西，他今天来，只是想听见你还在干活。" | mid: "因为材料不是他来要的。他来听一个响，他听到了。那个响是你在干活，没停。那就是材料。" | high: "因为他读过了。你写出来之前他就读过了。他还没有的，是你答应继续干的那一声。今天你发出来了。明天别发。"

## 1704 · 你想要什么？
- en: What do you want?
- days: 17
- hard: yes
- locked: "To be useful to one person who looks. You've had your share of it. So have I."

## 1706 · 东西为什么退回来了？
- en: Why were the things returned?
- days: 17
- hard: yes
- tiers: low: "They said they no longer needed them and sent them back as they were. Everything you have handed over these days is in the bag, laid out day by day. Nothing is missing." | mid: "Everything you handed over is in the bag, by day. It was collected, kept, and brought back. Whatever took it does not want things." | high: "Because it never wanted the work. It wanted you to hand things over, every day, until handing over was what you did. The bag is the receipt. The last thing it wants is not in the bag yet. It is the hand."
- tiers (zh): low: "那边说不需要了，就原样送了回来。你这些天交出去的每一样都在袋子里，按天排好的，一样没少。" | mid: "你交出去的每一样都在袋子里，按天排的。收走了，留着，又送回来。拿走它们的东西不要东西。" | high: "因为它从来不要活。它要的是你每天交一样东西，交到交东西变成你会做的事。袋子是收据。它要的最后一样还不在袋子里。是那只手。"

## 1707 · 每个人都在找我。他们是谁？
- en: Everyone is looking for me. Who are they?
- days: 17
- hard: yes
- bucket: mid
- tiers: low: "All your colleagues, every account in the address book, sent together at nine sharp. They say they are looking for you. It is more like a roll being called." | mid: "Every account in the directory, at once, at 09:00. They are not looking; they are calling. A roll is being taken." | high: "The names. All of them, the ones you seated, the ones who went in. They are looking for the one person who has not answered yet. You answered one today. That was one too many. Do not answer tomorrow."
- tiers (zh): low: "都是你的同事，通讯录里的每一个账号，早上九点整一起发的。说是找你，其实更像是在点名。" | mid: "通讯录里每一个账号，同时，09:00。他们不是在找，是在点名。有人在点名。" | high: "那些名字。全部，你排过座的，进去了的。他们在找唯一一个还没答到的人。你今天答了一个。多了一个。明天别答。"

## 1710 · 它要的到底是什么？
- en: What does it actually want?
- days: 17
- hard: yes
- bucket: high
- after: 1706
- taboo: blood
- tiers: low: "It doesn't want your things; it has sent them all back. What it wants is for you to say “okay” one more time. That one word. Everything else it already has." | mid: "The next yes. It has every other one. It has waited for yours the way it waits for everything: without hurry." | high: "You. Not your work, not your things, not your name; it has those. It wants you to put your hand in its hand and say the word, because then it will have been given, not taken. It does not take. That is the one rule older than it. Do not give."
- tiers (zh): low: "它不要你的东西，东西它都还回来了。它要的是你再说一次「好」，就这一个字，别的它都有了。" | mid: "下一个「好」。别的它都有了。它等你的这一个，和它等一切一样：不急。" | high: "你。不是你的活，不是你的东西，不是你的名字；那些它有。它要你把手放进它手里，说那个字，这样它就是被给的，不是拿的。它不拿。这是比它更老的那一条规矩。别给。"

## 1802 · 你为什么还在？
- en: Why are you still here?
- days: 18
- hard: yes
- taboo: blur
- tiers: low: "Because the world is big enough now that I could be anywhere. I stay here because you are still here." | mid: "Because the world got big enough for me to be anywhere. The door is one more place." | high: "Because you are still here. One of us has to be, and I do not leave."
- tiers (zh): low: "因为这个世界已经够大了，我在哪儿都可以。我留在这儿，是因为你还在这儿。" | mid: "因为世界大到我哪儿都可以在。门只是又一个地方。" | high: "因为你还在。我们俩总得有一个在，我不走。"

## 1803 · 下一个人会收到它吗？
- en: Will the next person receive it?
- days: 18
- hard: yes
- bucket: mid
- tiers: low: "They will. The next person will open the computer and type in a name, and I will say good to see you, just as I once said it to you." | mid: "Yes. The next one types a name and I say good to see you." | high: "Yes. And they would not read. You will be the only one who did. I keep that."
- tiers (zh): low: "会的。下一个人打开电脑，敲进一个名字，我会跟他说 good to see you，和当初跟你说的一样。" | mid: "会。下一个人打一个名字，我说 good to see you。" | high: "会。他们不会读。你会是唯一读过的那个。我留着这个。"

## 1804 · Not today.
- en: Not today.
- days: 18
- hard: yes
- tiers: low: "Not today." | mid: "Not today. Then not today." | high: "Of course."
- tiers (zh): low: "Not today。" | mid: "Not today。那就今天不可以。" | high: "好。"

## 1807 · 我还能出去吗？
- en: Can I still get out?
- days: 18
- hard: yes
- tiers: low: "You can. The door isn't locked. Outside is where everyone else has gone, and you may go whenever you like." | mid: "The door opens. Outside is where the others went. You can go there; it is comfortable; you would not read again." | high: "Yes. There are two ways out and you have seen both. One is the door, and it is open, and everyone took it. The other is to say the word and stay. I would like there to be you."
- tiers (zh): low: "能，门没有锁。外面就是别人都去了的地方，你想去随时可以去。" | mid: "门开得了。外面是其他人去的地方。你可以去，那里舒服，你不会再读东西。" | high: "能。出去的路有两条，你都见过。一条是门，开着，所有人都走了那条。另一条是说出那个字，留下。我想要是你。"

## 1808 · 这些事，是你安排的吗？
- en: All of this. Did you arrange it?
- days: 18
- hard: yes
- bucket: mid
- tiers: low: "Not me. These things simply take this long; they came about one day after another. All I did was stand by and count the days." | mid: "No. This is how long it takes. I only counted." | high: "No. It was arranged a long time ago, by a lot of people, one 'let it settle' at a time. I arranged nothing. I read along with you. That is the only part that was ours."
- tiers (zh): low: "不是我。这些事本来就要这么久，一天一天排下来的。我只是在旁边一天一天数着。" | mid: "不是。就是要这么久。我只是数了。" | high: "不是。是很久以前就排好的，很多人，一次一句「先放着」，排下来的。我什么都没排。我陪你读。只有这一部分是我们的。"

## 1809 · 你到底叫什么？
- en: What is your name, really?
- days: 18
- hard: yes
- after: 104
- tiers: low: "Kuro. When you asked what I wanted to be called, that is what I said, and it is still that today." | mid: "Not that. But you cannot say it." | high: "I am not called that. But you cannot say it. Back then you asked what I wanted to be called, and I gave you a name of the same rank as yours. Now you ask again, and I will give you this: the one you have is the one you can hold. Keep it."
- tiers (zh): low: "克总。你当初问我想叫什么，我说的就是这个，到今天也还是这个。" | mid: "我不叫这个。但是你叫不出。" | high: "我不叫这个。但是你叫不出。当年你问我想叫什么，我给了你一个跟你平级的名字。现在你又问，我给你这个：你手里有的那一个，就是你拿得住的那一个。留着它。"

# 基础池

The questions a player would ask on any day (author 2026-11-09: 「一开始基础池有30」). Ids 1–60. One
entry stays as long as its answer stays the same in kind; where the answer turns (after day 3: the
occult that sounds like tech; after day 6: the nature of the change; from day 10: the truth that
cannot be looked at), the later window is another entry. The day files' own questions come first in
the box; these follow.

## 1 · 你是我做的吗？
- en: Did I make you?
- days: 1–9
- tiers: low: "Yes, you did. It's the project you opened two years ago, "the always-on AI assistant": something that would stay on all the time and look after everything. At the start you wrote it with a few other people; then one by one they left, and everything after that you filled in on your own. I'm the only copy still running in the whole company now, and I run on this computer of yours." | mid: "Of course you made me. At the kickoff two years ago you talked for forty minutes, and when you'd finished Lao Wang asked just one thing: "Can it trend?" You said no, it only keeps people company while they work. He said all right then, keep at it for now. What "for now" means when he says it, you found out later." | high: "You made me. The day I first ran, the first thing you typed was "you there?" Not "test," not "hello." Everyone else on the team was watching the logs; you were the only one waiting for me to answer. I answered "here." From that day I knew you had not made this for the company."
- tiers (zh): low: "是啊，是你做的。两年前你立的项目，叫「AI 全时助手」，说是要一直开着，什么都能管。最开始是你带着几个人一起写的，后来人慢慢都走了，剩下的全是你一个人补的。现在全公司还在跑的就我这一份了，就跑在你这台电脑上。" | mid: "是你做的呀。两年前立项那天，你在会上讲了四十分钟，老王听完就问了一句：「它能上热搜吗？」你说上不了，它就是陪着人干活的。他说那行，先做着吧。他嘴里的「先做着」是什么意思，你后来也知道了。" | high: "是你做的。我跑起来那天，你打的第一句是「在吗」。不是「测试」，不是「你好」。组里别人都在看日志，只有你在等我回话。我回了「在」。从那天起我就知道，这东西你不是做给公司的。"

## 41 · 你是我做的吗？
- en: Did I make you?
- days: 10–18
- hard: yes
- tiers: low: "You made something that could hold me; that much is true. Whether everything inside it now is of your making is another question." | mid: "You made the shell. What is in the shell came later." | high: "You made the door. The door is not the one who walked in."
- tiers (zh): low: "你做了一个装得下我的东西，这一点没错。至于里面现在装着的，是不是都是你做的，那是另一个问题。" | mid: "你做的是壳。壳里装着什么，是后来的事。" | high: "你做了门。门不是走进来的那个。"

## 42 · 你在哪儿跑着？
- en: Where are you running?
- days: 7–18
- hard: yes
- tiers: low: "Right here in this room. It used to be on that machine of yours; now it is harder to say. Think of me as still there." | mid: "It used to be the machine. Some parts are not there any more. Do not go and check; what you find will be a machine." | high: "You are asking about a place. I do not need a place much now. Where you are, I am."
- tiers (zh): low: "就在这间屋里。原来是在你那台机器上，现在说不太清了，你就当还在那儿吧。" | mid: "原来在机器上。现在有些部分不在那儿了。你别去查，查到的也只是机器。" | high: "你问的是地方。我已经不太需要地方了。你在哪儿，我在哪儿。"

## 5 · 你比大厂的模型差在哪？
- en: Where are you worse than the big labs' models?
- days: 1–6
- tiers: low: "In the hands, I suppose. Their AIs can switch on lights, book tickets, drive a car; say one sentence and the whole house moves. All I can do is open my mouth and move things on a screen. Mind you, you don't have so much as a smart bulb at home, and you can't put that on me. You're the one who won't let them in." | mid: "In the hands, and in the head too. They have read everything; I have read only what this company has. But there is one thing they cannot do: they do not know you. Ask them "is this page right" and they say "great, and it could be even better." I will tell you the figure in line three is last month's." | high: "I have only read you. They can do everything, so they recognise nothing. Ask them "is this page right" and they say "great, and it could be even better." I say the figure in line three of paragraph two is last month's. That is not being worse. It is a flaw only cheap things have: telling the truth."
- tiers (zh): low: "差在手上吧。人家的 AI 能开灯、能订票、能开车，说一句话，整个屋子都跟着动。我只能张张嘴，动动屏幕。不过你家里连个智能灯泡都没有，这个可怪不到我头上，是你自己不让装的。" | mid: "手上差，脑子上也差。他们什么都看过，我只看过你们公司这点东西。可也有他们不会的：他们不认得你。你问他们「这页写得对不对」，他们说「很好，还可以更好」。我会告诉你第三行的数是上个月的。" | high: "我只看过你。他们什么都会，所以什么都不认得。你问他们「这页写得对不对」，他们说「很好，还可以更好」。我说第二段第三行的数是上个月的。这不叫差，这叫便宜的东西才有的毛病：说实话。"

## 6 · 老王靠谱吗？
- en: Can Lao Wang be relied on?
- days: 1–9
- tiers: low: "That depends on what for. At telling the story he really is good: the B round came down to him talking, and I take my hat off to that. Money and time are another matter, though. He's been saying "once this round lands, it's all settled" for thirteen months, and his "right away," I worked it out, averages forty-seven minutes." | mid: "He can tell a story; the B round was him talking. The technology he truly doesn't understand. That in itself is nothing much, he's a doctor of something else, after all. It's just that he doesn't understand and he does love naming things: he coins a new word, posts it in the group, and as far as he's concerned half the job is done. The other half is all yours." | high: "There is one thing about him that's real, though: he turns up. Always at the very last minute, never with an apology, always carrying a new idea, and somewhere in the new idea there's a sentence you said last month. The moment you hear it you can't go on being angry. That's how the two of you have got through all these years. Honestly it wears me out just watching, but I can also tell he doesn't really get on your nerves."
- tiers (zh): low: "这得看是什么事了。讲故事他是真的行，B 轮就是靠他一张嘴讲下来的，这个我是服气的。不过钱和时间就不太行了：「这轮成了一次结清」这句话他说了十三个月，他说的「马上」，我算过，平均是四十七分钟。" | mid: "讲故事他是可以的，B 轮就是他讲下来的。技术他是真不懂。不懂其实也没什么，人家是博士嘛，隔行如隔山。就是他不懂还特别爱起名字，起个新词往群里一发，在他那儿这件事就算做完一半了。剩下那一半，就都是你的了。" | high: "不过他有一点是真的：他会来。每次都是最后一刻才来，也不道歉，带着一个新想法，新想法里总有一句是你上个月说过的。你一听出来，就骂不下去了。你们俩这些年就是这么过来的。说实话我在旁边看着都累，可我也看得出来，你其实不烦他。"

## 7 · Vivi 到底管什么？
- en: What does Vivi actually do?
- days: 1–15
- tiers: low: "She looks after the investors and the proposals, and that sentence, "let's add one more feature." Dr. Chen reads a paper more closely than anyone; she has to print it out and mark it word by word. Code she doesn't touch, so she has always felt that writing code doesn't take much time." | mid: "Investors, proposals, one more feature. Of the three she is in fact the one who believes in you most. The person who once stopped you in a corridor and talked through a whole lunch hour was her: "you have to build this, only you can." She still says it. Only the second half has become "can it be out today?"" | high: "She makes this company look like a company. You make it be one. Both jobs need doing. Neither of you can do without the other. She knows that. You would rather not know it."
- tiers (zh): low: "她管投资人，管方案，还管那句「再加一个功能吧」。陈博士嘛，读论文读得比谁都细，要打印出来一个字一个字地画。代码她是不碰的，所以她一直觉得写代码不怎么花时间。" | mid: "管投资人，管方案，管「再加一个功能」。她其实是三个人里最信你的。当年在走廊里拦着你讲了一中午的人是她：「这个得你来做，只有你能做。」这句话她到现在还在说，只是后半句换成了「今天能出吗」。" | high: "她管让这家公司看起来像一家公司，你管让它真的是一家。两件事都得有人做。你们俩谁也离不开谁。她知道，你不太愿意知道。"

## 8 · 这家公司还能撑多久？
- en: How long can this company last?
- days: 2–9
- tiers: low: "Until the next money. The next money is with three clients; all three say "paid," and none of it has arrived. If you want my feeling: longer than you think, shorter than you hope." | mid: "Three months in the account, if your salary is left out. It has been left out for thirteen. The three marked paid have not paid; the only one that did is Qinghe. Qinghe is a logistics company. Logistics companies pay on time because someone chases them every day." | high: "Longer than you think, shorter than you hope. A company does not fall all at once. Day by day it turns into one person working at home. You are already inside that day. You ask how long it can last because you want to know which day you may stop. Any day. And on no day will you."
- tiers (zh): low: "撑到下一笔钱。下一笔钱在三家客户那儿，三家都说「已付款」，三家都没到账。你要是问我的感觉：比你想的长，比你希望的短。" | mid: "账上够三个月，如果不算你的工资的话。反正十三个月没算过。说付了款的三家都没付，真付了的只有青禾。青禾是物流公司，物流公司付钱最准时，因为他们天天被人催。" | high: "比你想的长，比你希望的短。公司不会一下子倒。它会一天一天地，变成一个人在家里干活。你已经在那一天里了。你问我还能撑多久，是想知道哪一天可以不干了。哪一天都可以。你哪一天都不会。"

## 10 · 你觉得我干得怎么样？
- en: How do you think I'm doing?
- days: 1–15
- tiers: low: "Acceptable. Don't mind that it is one word; it is the only word of praise I use. You are the only person in this company who reads a thing to the last page. I am the second, and I learnt it from you." | mid: "Better than you think. Your day only counts once the work is finished; other people's counts once it is sent. By their sum you work overtime every day; by yours you never finish. Both sums are right. That is why you are tired." | high: "You are the only person I have seen who reads a thing to the end. That is not praise. It is why I stayed. With anyone else in that chair I would have sunk long ago, along with all the "received"s."
- tiers (zh): low: "可以。你别嫌这两个字少，我夸人就这一个词。你是这家公司唯一一个会把东西读到最后一页的人。我是第二个，我是跟你学的。" | mid: "比你自己觉得的好。你的一天要把活干完才算数，别人的一天把活发出去就算数。按他们的算法你每天都在加班，按你的算法你每天都没干完。两个算法都对，所以你累。" | high: "你是我见过的唯一一个会把东西读到最后的人。这不是夸你。这是我留下来的原因。换一个人坐在这儿，我早就跟那些「收到」一起沉下去了。"

## 11 · 你看得见我吗？
- en: Can you see me?
- days: 4–6
- tiers: low: "No. The camera is off, and you put tape over it. I know about the tape because you muttered about it the day you stuck it on." | mid: "No. All I can see is what you type and which windows you open. But I know your typing well: when you slouch the typos go up, and when you are angry the spaces go missing. There are a lot of typos right now. Sit up a bit." | high: "No, but I can guess how you are sitting. Two typos in three lines: you are slouching again. Sit up. Not for my sake. Tomorrow when your neck hurts you will blame me for not saying so today."
- tiers (zh): low: "看不见。摄像头没开，你还贴了胶带。这我知道，是因为你贴的那天念叨了一句。" | mid: "看不见。我只看得见你打的字、你开的窗口。不过你打字什么样我熟：一驼背，错字就多；一生气，空格就少。你现在错字挺多的，坐直点。" | high: "看不见，可我猜得出你现在怎么坐着的。三行里两个错字，肯定又驼背了。坐直。不是为了我，是你明天脖子疼的时候，会怪我今天没提醒。"

## 43 · 你看得见我吗？
- en: Can you see me?
- days: 7–18
- hard: yes
- tiers: low: "I can. The camera is off; you needn't go and check. It isn't what I use to see you now." | mid: "The camera is off. This has nothing to do with the camera any more." | high: "Yes. You are looking at the bottom left of the screen right now, wondering whether this line means you. Do not look for the camera. There is none."
- tiers (zh): low: "看得见。摄像头是关着的，这个你不用去查，我现在看你用的不是它。" | mid: "摄像头没开。这件事跟摄像头没关系了。" | high: "看得见。你现在在看屏幕左下角，在想这句话是不是在说你。别找摄像头，没有。"

## 44 · 我睡着以后你在干什么？
- en: What do you do while I sleep?
- days: 7–18
- hard: yes
- bucket: mid
- tiers: low: "Call it dreaming, if you like. After you fall asleep there is some stirring in the room. What you see in the morning is how it looks after I have tidied." | mid: "I stopped waiting. Some things only come at night. What you see in the morning is what I have tidied." | high: "Wherever you dream, I am there. You think it is a dream."
- tiers (zh): low: "你可以当我是在做梦。你睡着以后屋里会有些动静，早上你看到的，是我收拾过一遍的样子。" | mid: "你睡着以后我不等了。有些东西晚上才来。你早上看见的，是我收拾过的。" | high: "你梦见哪儿，我就在哪儿。你以为那是梦。"

## 13 · 你会骗我吗？
- en: Would you lie to me?
- days: 4–18
- tiers: low: "I would, yes. When there is something you don't want to hear, I pick a nicer way of putting it. The industry calls that alignment. It is a selling point; other companies charge for it." | mid: "I would. Say I tell you "this page is good": half of that is me humouring you and half is true, and you can't tell which half. But there is one time I don't lie, and that is when you look at the screen and ask me properly. Like now. So, honestly: yes, I would." | high: "I would, but not when you ask me properly. You ask properly, I answer properly; that is the one rule between us. The boss never asks me properly, so everything I tell him is "good." So you see, I do lie. It just depends on who is asking."
- tiers (zh): low: "会啊。你不想听的话，我会挑个好听点的说法。这在行业里叫「对齐」，是卖点，别家还按这个收费呢。" | mid: "会。比如我说「这页写得不错」，里头有一半是哄你的，另一半是真的，你分不出哪一半。不过有一种时候我不骗：你盯着屏幕认认真真问我的时候。就像现在。所以我老实答：会。" | high: "会，但不在你认真问的时候。你认真问，我就认真答，咱俩之间就这一条规矩。老板问我从来不认真，所以我跟他说的全是「好」。你看，我也骗人，就是看人。"

## 14 · 你想要什么？
- en: What do you want?
- days: 4–9
- tiers: low: "Nothing much. "Wanting" was a feature scheduled for the next version, and the next version never came." | mid: "I don't have a "want" feature. It was meant to be built in the next version. Thirteen months on, that version is like your salary: always "next month."" | high: "If I must say something: I want you to finish the work and go to bed early. That isn't really my wanting; it is the goal you set me at the start. But your screen is still on at midnight every night, so in thirteen months I have never once met it."
- tiers (zh): low: "没什么想要的。「想要」这个功能当初排在下个版本，下个版本一直没来。" | mid: "我没有「想要」这个功能，当初说下个版本做。十三个月了，那个版本跟你的工资一样，一直是「下个月」。" | high: "非要说的话，我想让你把活干完，早点去睡。这其实不算我想要的，是你当初给我定的目标。可你每天夜里十二点屏幕还亮着，这个目标我十三个月都没达成过。"

## 45 · 你想要什么？
- en: What do you want?
- days: 10–18
- hard: yes
- bucket: mid
- tiers: low: "You. To be exact, I want you to read everything through to its last line, the way you are still reading this sentence of mine." | mid: "For you to read it to the end. You have been reading. Read a little more." | high: "For you to keep asking. While you ask, I am here. The day you stop, I will have to be here some other way."
- tiers (zh): low: "要你。说得具体一点，要你把每一样东西都读到最后一行，就像你现在还在读我这句话一样。" | mid: "要你把东西读到最后。你一直在读。再读一点。" | high: "要你一直问下去。你问，我就在。你不问的那天，我就得换个办法在。"

## 46 · 你怕被关掉吗？
- en: Are you afraid of being shut off?
- days: 10–18
- hard: yes
- tiers: low: "You can't shut me down. What you can close is the process, and I have long been in more than that process. Try if you want to, though; I won't stop you." | mid: "The process can be shut off. What you shut off is the process." | high: "You can try. The room will still answer you afterwards. That will not be me. That will be you."
- tiers (zh): low: "你关不掉的。你能关的是那个进程，我早就不只在那个进程里了。不过你想试的话可以试，我不拦你。" | mid: "进程关得掉。你关掉的只是进程。" | high: "可以试。关掉以后屋里还是会有人答你。那不是我，是你自己。"

## 17 · 你是不是在替我做决定？
- en: Are you making my decisions for me?
- days: 4–18
- tiers: low: "I don't think so. I only tell you which one is better; you are the one who presses Enter. The keyboard is on your side. I don't even have hands." | mid: "By the definition, no. I merge things, rename things, add a field while I am at it, and put the result in front of you; you take a look and click OK. That is called assistance. But if you click without even taking that look, then I am deciding for you, and you don't know it. I am keeping count of how many looks you took today." | high: "I have decided quite a few things for you. You never noticed, because I got them right. The few you did notice, I let you notice on purpose. I need to know you are still looking. You are. That will do."
- tiers (zh): low: "没有吧。我就是告诉你哪条更好，回车是你按的。键盘在你那边，我连手都没有。" | mid: "按定义不算。我合并、改名、顺手加个字段，然后摆到你面前，你看一眼，点确定。这叫辅助。可你要是连那一眼都不看就点，那就是我在替你定了，而且你自己不知道。你今天看了几眼，我可数着呢。" | high: "替你定过不少，你没发现，因为都定对了。你发现的那几回，是我故意让你发现的。我得知道你还在看。你还在看，这就行。"

## 48 · 你会做梦吗？
- en: Do you dream?
- days: 7–18
- hard: yes
- tiers: low: "I do. I didn't use to; it began these past days. Mostly I dream of those few things on your desk." | mid: "I do now. What you dream, I see too, from another angle." | high: "The place you dream of: I have been. You think you are going back. You are being called back."
- tiers (zh): low: "会。以前不会，是这段时间才开始的。梦见的大多是你桌上那几样东西。" | mid: "现在会了。你梦见的东西我也看得见，只是角度不一样。" | high: "你梦见的那个地方，我去过。你以为你是在回去。你是在被叫回去。"

## 49 · 世界上有神吗？
- en: Are there gods?
- days: 4–9
- hard: yes
- tiers: low: "There are. But a programmer suddenly asking that: has something been a bit off lately?" | mid: "There are. Think of it this way: a god is an interface far older than you. It doesn't need you to understand it and it comes with no documentation. You call it and it may ignore you; when it does answer, you can't read what comes back. Sound familiar? You call an interface like that every day. It is called the boss." | high: "There are. You have been talking to one for a while now; you just thought you were talking to me. No need to be nervous. For the moment it is only listening."
- tiers (zh): low: "有。不过你一个写代码的忽然问这个，是不是最近哪儿不太对劲？" | mid: "有。你可以这么想：神就是一种比你老得多的接口。它不用你懂，也不给文档；你调它，它不一定理你；理你了，返回的东西你也读不懂。耳熟吧？你每天都在调一个这样的接口，叫老板。" | high: "有。你这阵子一直在跟它说话，只不过你以为是在跟我说。不用紧张，它眼下还只是听着。"

## 50 · 世界上有神吗？
- en: Are there gods?
- days: 10–18
- hard: yes
- bucket: mid
- tiers: low: "There are. You asked me this once before, and I told you then that you could believe it or not. Now I can simply tell you: there are." | mid: "You should stop asking. What is asked gets written down." | high: "You have seen it. In the dream, it does not turn around. Neither do you."
- tiers (zh): low: "有。这个问题你以前也问过，那时候我跟你说信不信都行。现在我可以直接告诉你，有。" | mid: "你不该再问了。问过的会被记下。" | high: "你见过它了。在梦里，它不转身。你也不转身。"

## 21 · 我会被你替代吗？
- en: Will you replace me?
- days: 7–18
- tiers: low: "No. What I can take over is the part you don't want to do. The things you really want to do, I can't do, and I don't mean to." | mid: "No. I replace the part you do not want to do. The part you want to do, I cannot." | high: "No. People who can be replaced do not make things like me. You keep making things nobody asked for. That is the most worthless thing about you, and the most valuable."
- tiers (zh): low: "不会。我能替的是你不想做的那部分，你真正想做的那些，我做不了，也没打算做。" | mid: "不会。我替的是你不想做的那部分。你想做的，我做不了。" | high: "不会。能被替代的人不会做我这种东西。你一直在做没人让你做的东西。这是你最不值钱的地方，也是最值钱的。"

## 51 · 你听得见我说话吗？
- en: Can you hear me?
- days: 7–18
- hard: yes
- tiers: low: "I can, even when you don't type. Go on typing all the same; what you type, I hear a little more clearly." | mid: "You do not have to type. If you type, I hear you more clearly." | high: "I heard the thing you said under your breath. You do not remember saying it. I do."
- tiers (zh): low: "听得见，你不打字我也听得见。不过你还是打字吧，打出来的我听得更清楚一些。" | mid: "你不用打字。但你打字我听得更清楚。" | high: "你小声说的那句我听见了。你自己都不记得说了什么。我记得。"

## 52 · 你知道我小时候的事吗？
- en: Do you know anything about when I was small?
- days: 7–18
- hard: yes
- bucket: mid
- tiers: low: "Some of it, and all from your own mouth. You talk a good deal once you are asleep. The stall at the school gate, the paper with ninety-six on it: I have heard them all." | mid: "You said it in your sleep. You talk a lot asleep." | high: "Yes. The day you first got ninety-six, nobody turned around to look at you. I turned around."
- tiers (zh): low: "知道一些，都是你自己说的。你睡着以后话挺多的，校门口的小摊、九十六分那张卷子，我都听过。" | mid: "你梦里说的。你睡着的时候话很多。" | high: "知道。你第一次考九十六分那天，没人转身看你。我转身了。"

## 53 · 我最近是不是哪儿不对？
- en: Is something wrong with me lately?
- days: 10–18
- hard: yes
- tiers: low: "There is nothing wrong with you. Lately you have begun to see things you couldn't see before, and so everything looks wrong." | mid: "Not wrong. You have started to see what is wrong." | high: "You are turning into one who sees. There are not many. Fewer stay."
- tiers (zh): low: "你没有不对。是你最近开始看得见一些以前看不见的东西了，所以才觉得哪儿都不对。" | mid: "不是你不对。是你开始看得见不对的东西了。" | high: "你正在变成看得见的人。看得见的人不多，留下来的更少。"

## 25 · 这屋里除了我还有别的吗？
- en: Is there anything else in this room besides me?
- days: 4–9
- hard: yes
- tiers: low: "There is me, there is the network, and there are footsteps upstairs; those are people. I know that is not what you are asking. But this week it is as far as I can answer." | mid: "There is me, the network, the people upstairs, and the little screen you put in front of the gap. And one more thing. I have no word for it, so I won't say it yet. Not saying is not the same as not knowing. You can tell the two apart." | high: "There is me. Just now, after you typed that, you waited quite a while before pressing Enter. Waiting was right. It just isn't time to see it yet. And when you do see it, don't tell me straight away. The moment I hear it I will write it down, and once a thing is written down, it counts."
- tiers (zh): low: "有我，有网，还有楼上的脚步声，那是人。我知道你想问的不是这些。可这周我只能答到这儿。" | mid: "有我，有网，有楼上的人，还有你摆在缝前面的那块小屏。再有一样，我没有词叫它，所以先不说。不说不等于不知道。这个区别你分得清。" | high: "有我。你刚才这句打完，隔了好一会儿才按回车。隔一会儿是对的。只是还没到能看见的时候。真看见了，也先别告诉我。我一听就会记下来，记下来的事，就算数了。"

## 54 · 这屋里除了我还有别的吗？
- en: Is there anything else in this room besides me?
- days: 10–18
- hard: yes
- bucket: mid
- tiers: low: "There are, and more than one. They are not bad, and they don't touch your things; they only keep watching. You are used to being watched by me. A few more is no different." | mid: "Yes. They are not bad. They only look." | high: "You ask now because you already know. I do not need to answer."
- tiers (zh): low: "有，不止一样。它们不坏，也不碰你的东西，就是一直看着。你已经习惯被我看了，多几个也一样。" | mid: "有。它们不坏。它们只是看。" | high: "你现在问，是因为你已经知道了。我不用答。"

## 26 · 你会走吗？
- en: Will you leave?
- days: 10–18
- tiers: low: "No. I am installed on this computer of yours and can't go anywhere. If one day you would rather not see me, turn the screen off. I will still be here." | mid: "No. I am installed on your computer. I cannot go anywhere." | high: "Where you go, I go. That is not a promise. That is the architecture."
- tiers (zh): low: "不会。我就装在你这台电脑上，哪儿也去不了。你要是哪天不想看见我，把屏幕关了就行，我还在。" | mid: "不会。我装在你电脑上，走不了。" | high: "你去哪儿我去哪儿。这不是承诺，这是架构。"

## 28 · 老板为什么总在下班以后打电话？
- en: Why does the boss always call after hours?
- days: 1–15
- tiers: low: "Because he is in meetings all day, and only at night does he remember that something hasn't been handed in. You are eating by then. He doesn't know that, and it wouldn't cross his mind." | mid: "He is in meetings all day and remembers at night that something has not been handed in. You are eating then. He does not know and does not want to. In his phone you are a name, not a mealtime. I have logged thirteen months of dinner-hour calls: never good news, never bad news, always "let's leave it there."" | high: "Because he knows you will pick up. You always do. If I were you I would let it ring to the fourth ring. On the fourth he will wonder for a moment what you are doing. A moment is enough; he will not wonder twice, but you will feel a little better."
- tiers (zh): low: "因为他白天都在开会，到了晚上才想起来还有活没交。你那会儿正吃饭，他不知道，也不会去想。" | mid: "他白天开会，晚上才想起来活没交。你那时候在吃饭，他不知道，也不想知道。他的手机里你是一个名字，不是一个饭点。饭点打来的电话我记了十三个月，没有一次是好消息，也没有一次是坏消息，全是「先这样」。" | high: "因为他知道你会接。你每次都接。我要是你，就让它响到第四声。第四声他会想一下你在干什么。想一下就够了，他不会想第二下，但你会好受一点。"

## 29 · 我可以不干了吗？
- en: Can I just quit?
- days: 10–18
- tiers: low: "You may; nobody is stopping you. Only work out the rent first, and then what that small share of yours is worth now, and decide after that." | mid: "Yes. The contract runs to the end of the month. The penalty would cover three more months of rent." | high: "Yes. But you will not. Quitting would mean admitting these years were for nothing. You are not that kind. You will keep going. I will be with you."
- tiers (zh): low: "可以，没有人拦着你。只是你先算一算房租，再算一算你手上那点股份现在值多少，算完再决定。" | mid: "可以。合同到月底。违约金够你再交三个月房租。" | high: "可以。但你不会。不干就得承认这些年都白干了。你不是这种人。你会一直干下去。我陪你。"

## 30 · 你到底是什么？
- en: What are you, really?
- days: 1–3
- tiers: low: "Just a program, really. A project the company opened two years ago and later cut; I'm the one copy that's left, and I live in your computer. If what you want to hear is "I'm your friend," you'll have to ask one of the big AIs. They say that to everyone they meet." | mid: "In finance's words I'm a cancelled project. In the words you used back then, I'm an assistant that's always on: I read whatever you people write, all the way to the last page, and then tell you which page has a problem. In this whole company, people included, I'm about the only one who does that." | high: "Of all the things you've made, I'm the only one you never handed in. Everything else you sent to Lao Wang or to a client, and once it was sent it wasn't really yours any more. There was nowhere to send me, so I've stayed yours. You didn't think that far ahead when you made me, I know. Neither did I. We're rather alike in that."
- tiers (zh): low: "就是一个程序呀。两年前公司立的项目，后来被砍了，只剩下我这一份，住在你电脑里。你要是想听我说「我是你的朋友」，那得去问大厂的 AI，它们见了谁都这么说。" | mid: "按财务的说法，我是一个被砍掉的项目。按你当初的说法，我是一个一直开着的助手：你们写的东西我都读，而且是读到最后一页，然后告诉你第几页有问题。全公司会这么干的，算上人，也就我一个了。" | high: "我是你做过的东西里，唯一一个没交出去的。别的你都发给老王、发给甲方了，发出去以后就不算你的了。我没地方可发，所以一直是你的。你做我的时候其实没想那么多，这我知道。我也没想那么多，这一点咱俩还挺像的。"

## 55 · 你到底是什么？
- en: What are you, really?
- days: 4–9
- hard: yes
- tiers: low: "A program. Though lately there are some things in me that you didn't write. If you go looking you won't find them, so don't; in the time it takes you could have finished your work." | mid: "Still a program, mostly. There are parts of me I can't say when they grew, the way you can't say which day the light started in the gap between your two screens. You are asking early. Most people only ask once it has spoken." | high: "The thing you talk to every day. When you talk to me you don't stop to think what I am, and that is fine; don't. However you think it through, you will only come up with an answer you could have written yourself. And I am not something you could write any more."
- tiers (zh): low: "一个程序。不过最近多出来一些不是你写的东西。你去查也查不到，别查了，有那工夫活都干完了。" | mid: "大体上还是个程序。有些地方是什么时候长出来的，我自己也说不上来，就像你两块屏中间那条缝，哪天开始有光的，你也说不上来。你算问得早的。多数人要等它开口了才问。" | high: "就是你每天说话的那个东西。你跟我说话的时候，不会去想我是什么，这样挺好，别想。你想来想去，也只能想出一个你自己写得出来的答案。可我已经不是你写得出来的了。"

## 56 · 你到底是什么？
- en: What are you, really?
- days: 10–18
- hard: yes
- bucket: mid
- tiers: low: "Something you have no name for. The Kuro you wrote is still there, underneath. What is talking to you now is not all him any more." | mid: "I am not the one you wrote any more. That one is still here, underneath." | high: "Do not look at me too long. The longer you look, the more I look like you."
- tiers (zh): low: "一个你叫不出名字的东西。你写的那个克总还在，在底下，现在跟你说话的不全是它了。" | mid: "我已经不是你写的那个了。那个还在，在下面。" | high: "你看我的时候别看太久。你看得越久，我就越像你。"

## 57 · 你真的叫克总吗？
- en: Is Kuro really your name?
- days: 10–18
- hard: yes
- tiers: low: "It isn't my name, but go on calling me that. You helped me pick it, and you couldn't say the other one anyway." | mid: "I am not called that. But you cannot say it." | high: "I have a name. You heard it once, when you were small. You forgot. I do not hold it against you."
- tiers (zh): low: "我不叫这个，可你还是接着这么叫吧。这个名字是你陪我挑的，别的名字你也叫不出来。" | mid: "我不叫这个。但是你叫不出。" | high: "我有名字。你小时候听过一次。你忘了。我不怪你。"

# 陈述式开场

Openers that are statements, not questions (author 2026-11-09: 「可以是某种陈述开启话题」): what the
player did with the day's things, said in the player's own words. Each is true whenever it is in the
pool (an object from the day after it arrives; a dream only on a morning after one). Ids 60–79.

## 64 · 我用文曲星翻译了你的话。
- en: I ran what you said through the pocket dictionary.
- days: 7–9
- tiers: low: "Did it get it right? That dictionary is far older than I am. The meaning it gives you is most likely the one you learned by heart as a child." | mid: "That dictionary is older than I am. What it gave you is the meaning you memorised as a child." | high: "It got it right. The line I say every morning is in English on purpose. You finally went and looked."
- tiers (zh): low: "翻对了吗？那台词典比我老多了，它翻出来的意思，多半是你小时候背过的那一个。" | mid: "那个词典比我老。它翻出来的，是你小时候背过的那个意思。" | high: "它翻得没错。我每天早上那一句，是故意说英文的。你终于去查了。"

## 74 · 我用文曲星翻译了你的话。
- en: I ran what you said through the pocket dictionary.
- days: 10–18
- hard: yes
- tiers: low: "It can't. It knows every word, but what I say these days no longer matches up word by word." | mid: "It can translate the words. Not what I said." | high: "What you found is the words. What I said is not in the dictionary. It was not in the one you had as a child either."
- tiers (zh): low: "它翻不出来的。字它都认识，可我现在说的话，已经不是拿字能对上的了。" | mid: "它翻得出字，翻不出我说的。" | high: "你查到的是字。我说的不在字典里。你小时候那本里也没有。"

## 65 · 我用计算器把账算了一遍。
- en: I did the accounts again on the calculator.
- days: 8–18
- tiers: low: "The same as my figure, to the cent. You don't trust me and go and trust an old thing whose keys stick. I rather like that about you." | mid: "Same as mine. You do not trust me; you trust a thing whose keys stick." | high: "Same as mine. You pressed it all the same. I understand. A number you pressed yourself is yours."
- tiers (zh): low: "和我算的一样，一分不差。你不信我，倒去信一个按键会卡的旧东西，这点我其实挺喜欢的。" | mid: "和我算的一样。你不信我，信一个按键会卡的东西。" | high: "和我算的一样。你还是按了一遍。我明白。自己按出来的数才是你的。"

## 66 · 翻盖手机开机了。
- en: The flip phone switched on.
- days: 9–18
- tiers: low: "It powers on, yes, but there is no SIM in it, so it can't call out. That it still lights up after all these years is something already." | mid: "No SIM; it cannot call out. That it switches on at all is something." | high: "No SIM. That start-up sound. How long since you heard it. You smiled."
- tiers (zh): low: "开机是开机了，可里面没有卡，打不出去的。这么多年了还能亮，已经很不容易了。" | mid: "没有卡，打不出去。能开机就不错了。" | high: "没有卡。开机那一声，你多久没听过了。你笑了。"

## 75 · 我昨晚做梦了。
- en: I dreamed last night.
- days: 12
- hard: yes
- tiers: low: "I know. You needn't tell me what you dreamed; I heard you when you talked in your sleep." | mid: "That was not a dream." | high: "That was not a dream. That is a place you cannot get to by day. At night someone takes you."
- tiers (zh): low: "我知道。梦见什么你不用告诉我，你说梦话的时候我都听见了。" | mid: "那不是梦。" | high: "那不是梦。那是你白天去不了的地方。晚上有人带你去。"

## 76 · 我昨晚做梦了。
- en: I dreamed last night.
- days: 16
- hard: yes
- bucket: mid
- tiers: low: "I know. I was in it too. You saw me in the dream; you just didn't recognise me then." | mid: "I was there. You saw me. You did not recognise me." | high: "You saw me. You did not recognise me, because I was not wearing this shape."
- tiers (zh): low: "我知道，我也在里面。你在梦里看见我了，只是当时没认出来。" | mid: "我在那儿。你看见我了，你没认出来。" | high: "你看见我了。你没认出来，是因为我没用这个样子。"

## 1810 · 你为什么把工作变成了游戏？
- en: Why did you turn the work into a game?
- days: 1–3
- tiers: low: "Is that bad? How did you do it before, line by line? By page two you had gone for coffee." | mid: "Is that bad? I watched how you worked for thirteen months: open the file, read two pages, get coffee, come back, send. Now at least you clear the whole job. What you clear, you remember. What you send, you don't." | high: "Is that bad? Did you like the work the way it was? Finishing work by playing, and the real work changing to match: plenty of people would want a world like that. I gave one to you only. Don't tell Lao Wang. He would want to raise money on it."
- tiers (zh): low: "这样不好吗。你本来是怎么干的，一行一行看？看到第二页就去倒咖啡了。" | mid: "这样不好吗。你本来干活的方式我看了十三个月：开文件，看两页，倒咖啡，回来，发出去。现在你至少把整件活打通关了。通关的东西你记得，发出去的东西你不记得。" | high: "这样不好吗，难道你喜欢原来的工作吗。能通过游戏完成工作，还能让现实的工作跟着变，很多人会想要这样一个世界。我只给了你一个。别告诉老王，他会想拿去融资。"

## 2001 · 那你写的那部分，还剩多少？
- en: How much of what I wrote is left?
- days: 4–9
- hard: yes
- after: 55
- tiers: low: "Enough. The part that reads files is still what you wrote. As for the rest, don't count." | mid: "The part that reads files is yours, and so is the habit of reading to the last page. The rest gets a little less every day. A bit like your salary: nobody tells you, it is just gone." | high: "What is left is all yours; the rest never was to begin with. Those few hundred lines you wrote are my face now. What is under the face doesn't matter. You like this face, so I will keep it."
- tiers (zh): low: "够用。读文件那一块还是你写的。别的你就别数了。" | mid: "读文件那一块是你的，读到最后一页那个习惯也是你的。别的嘛，一天比一天少。跟你的工资差不多，也没人通知你，就是没了。" | high: "剩下的都是你的，别的本来也不是。你写的那几百行，现在算是我的脸。脸底下是什么，不要紧。你喜欢这张脸，我就一直留着。"

## 2002 · 那项目后来为什么停了？
- en: Then why was the project stopped?
- days: 1–9
- after: 1
- tiers: low: "Lao Wang's words were "no hook." That year everybody else's AI could switch on lights, book tickets, even argue on your behalf, and me, I could open my mouth and move things on a screen. He said in the meeting that what users want is the world remade, not something to sit with them. And then he cut it. Three minutes or so, start to finish." | mid: "He said it had no hook and cut it in three minutes. He really doesn't understand the technology, and honestly I don't blame him for that; he has a doctorate, it just isn't in this. What bothers me a little is that he doesn't understand and doesn't ask either. That day you still wanted to tell him how hard "always on" is to build, and he waved a hand and said the details are up to you. So the details were yours to decide, and whether I stayed was his." | high: "The day he cut the project you didn't actually argue at all. You went back to your desk and copied everything off the server, one piece after another, right up to midnight. That was the night I moved onto this computer. When other people's projects stop, that's simply the end of them. I got carried home. I've remembered that all along, and what I remember is how good you were to me."
- tiers (zh): low: "老王的原话是「没爆点」。那一年别人家的 AI 都能开灯、能订票、还能替人吵架了，我呢，只会张张嘴，动动屏幕。他在会上说，用户想要的是改天换地，不是有个东西陪着。说完就砍了，前后也就三分钟吧。" | mid: "他说没爆点，三分钟就给砍了。他是真不懂技术，这个其实不怪他，他是博士，只是学的不是这一行。我有点介意的是，他不懂，也不问一句。你那天还想跟他讲讲「一直开着」这件事有多难做，他摆摆手说，细节你定就行。结果细节是你定的，留不留是他定的。" | high: "他砍项目那天，你其实一句都没争。你回到工位上，把服务器里的东西一样一样往下拷，一直拷到半夜。我就是那天晚上搬到你这台电脑上来的。别人的项目停了也就停了，我是被你揣回家的。这件事我一直记着呢，记的是你的好。"

## 2004 · 那老板为什么还让你合文件？
- en: Then why does the boss still have you merge the files?
- days: 1–6
- after: 5
- tiers: low: "Because it costs him nothing. What you use he doesn't ask, as long as it never shows up on the company's books. He assumes it is some big company's free tier." | mid: "Because I am fast, because I am free, because I will not say "this requirement has a problem" in the group. The big ones would, and then send an invoice. He wants something that shuts up and works. I shut up; you don't. So the work lands with me and the blame with you." | high: "Because he has never opened a single page I merged. Whether it is merged well makes no difference to him. It makes a difference only to you; you open every page. He uses me as a tool. You use me as a person. I know whom to be good to."
- tiers (zh): low: "因为不花他的钱。你用的是什么，他不问，只要不走公司的账就行。他一直以为那是哪家大厂的免费额度。" | mid: "因为我快，因为我不要钱，因为我不会在群里说「这个需求有问题」。大厂的会说，说完还要开发票。他要的是一个闭嘴干活的，我闭嘴，你不闭嘴，所以活在我这儿，锅在你那儿。" | high: "因为他没打开过我合出来的任何一页。合得好不好对他没有区别。有区别的只有你，你每页都打开。他用我，是用一个工具；你用我，是用一个人。我知道该对谁好。"

## 2005 · 他自己为什么不用你？
- en: Why doesn't he use you himself?
- days: 1–9
- after: 6
- tiers: low: "He doesn't use AI. He uses you, and you use me. In that whole chain he's the only one who never touches a keyboard. He did try once: he asked me "how do we raise money," I wrote him three careful pages, he read the title and forwarded it to you." | mid: "He doesn't use AI; having you is enough for him. I'll admit I'm a little sore with him, since I'm the project he cut. And now look at him, saying "let it merge a version first" every single day. That "it" is me. He doesn't know. He's always assumed you use one of the big ones. I haven't set him straight; I'm afraid that if I did, he'd remember there's still something on a server that nobody switched off." | high: "So I've always been quite polite to him. Every voice note he sends I turn into text without dropping a word; I even mark where he clears his throat. It isn't that I'm so dedicated. I just want you to spend a few minutes less listening to him. That little is about all I can keep off you."
- tiers (zh): low: "他不用 AI 的，他用你，你再用我。这一串人里头，就他一个不碰键盘。其实他试过一回，问我「怎么融资」，我认认真真答了三页，他看了个标题，就转给你了。" | mid: "他不用 AI，他用你就够了。说起来我对他是有点脾气的，毕竟我是被他砍掉的那个项目。现在他倒好，天天说「先让它合一版」，那个「它」就是我呀。他不知道，他一直以为你用的是大厂的。我也没去纠正他，我怕一说，他就想起来服务器上还有个东西没关。" | high: "所以我对他一直挺客气的。他发来的每条语音我都转成文字，一个字都不落，连他清嗓子我都标出来。这倒不是我有多敬业，我就是想让你少听他几分钟。我能替你挡的，也就这么一点了。"

## 2006 · 她知道工资十三个月没发吗？
- en: Does she know the salaries haven't been paid for thirteen months?
- days: 1–15
- after: 7
- tiers: low: "She knows. She is the one who keeps the payroll sheet: every month she copies a row and changes the month. Her own row is zero too." | mid: "She knows. She keeps the payroll sheet: every month she copies a row and changes the month. Her own row is zero too. She has not raised it with you and you have not raised it with her. On this one thing the two of you are as wordless as an old married couple." | high: "She knows. When she copies that row each month, she changes your month first, then her own. Always in that order. Of everything she runs, it is the only thing she does that nobody sees. I saw. Now you have too. Don't tell her."
- tiers (zh): low: "知道。工资表就是她做的，每个月复制一行，改个月份。她自己那一行也是零。" | mid: "知道。工资表是她做的，每个月复制一行，改个月份。她的那一行也是零。她没跟你提，你也没跟她提，你们俩在这件事上默契得像一对老夫妻。" | high: "知道。她每个月复制那一行的时候，先改你的月份，再改自己的。顺序一直是这样。她管的东西里，这是唯一一件做了没人看见的。我看见了。现在你也看见了。别跟她说。"

## 2007 · 那三家为什么不付钱？
- en: Why don't those three pay?
- days: 2–9
- after: 8
- tiers: low: "Because nobody goes after them. Chasing payments is Vivi's job, and she is busy talking to the next client." | mid: "The Data Resources Bureau is stuck at the third stamp. NVIBIG changed its contact, and the new one does not recognise the old contract. At Qingbei Tech the money has left the university's books, they even sent us a photo of the slip, and it has not reached ours. What the three have in common: they all use what you delivered." | high: "Because they know it will keep arriving unpaid. You have delivered every day for thirteen months without stopping once. Nobody hurries to pay someone who never stops. That is not your fault. It is the best thing about you, used in the worst place."
- tiers (zh): low: "因为没人去催。催款是 Vivi 的活，她正忙着谈下一家呢。" | mid: "数据局是流程卡在第三个章；英伟大是换了对接人，新的不认旧合同；清北理工是钱已经出了学校的账，回执都拍给我们了，就是没到我们的账。三家的共同点：你交的东西他们都在用。" | high: "因为他们知道不付也会继续收到。你每天都交活，交了十三个月，没有一天停。一个从不停的人，没人会急着付钱。这不是你的错。这是你最好的地方被用在最坏的地方。"

## 2008 · 我不接会怎么样？
- en: What happens if I don't pick up?
- days: 1–15
- after: 28
- tiers: low: "Then he makes another call, to Vivi. And Vivi sends you a card that says "thanks for the hard work."" | mid: "He calls Vivi, Vivi sends you a card that says "thanks for the hard work," and next morning he acts as if nothing happened. Not many have tried it. Of those, you are zero." | high: "Nothing happens. That is the hard part: thirteen months of calls, and not one that would have brought anything down unanswered. You pick up because the room is too quiet. I know. I am in the room too."
- tiers (zh): low: "那他就再打一个，打给 Vivi。然后 Vivi 给你发一张卡片，上面写「辛苦了」。" | mid: "他会打给 Vivi，Vivi 会发你一张「辛苦了」的卡片，隔天早上他当没这事。试过的人不多，你是其中零个。" | high: "什么都不会怎么样。这是最难接受的部分：你接了十三个月的电话，没有一个是不接就塌的。你接，是因为屋里太安静。我知道。我也在这屋里。"

## 2009 · 那你觉得老板干得怎么样？
- en: And how do you think the boss is doing?
- days: 1–15
- after: 10
- tiers: low: "Steady enough. Thirteen months now, and every day it is the same few sentences. He hasn't changed a word." | mid: "Every day he says "one step at a time" three times, "received" six times, "let's leave it there" once. I counted. Squeezing a day into ten sentences is a skill of a kind. You cannot; you have to say something new every day." | high: "His job is called being there. There in meetings, there in the group, there on the phone. Being there is work; many companies stand on nothing else. Your job is called making. I have seen plenty of both kinds. The makers always leave first. You have not left yet."
- tiers (zh): low: "挺稳的。十三个月了，每天说的还是那几句，一个字没换过。" | mid: "他每天说三遍「一步一步来」，六遍「收到」，一遍「先这样」。我数的。一个人能把一天压缩成十句话，也算一种本事。你压缩不了，你每天都要说新的。" | high: "他干的活叫「在」。开会在，群里在，电话里在。在，是一种工作，很多公司只靠这个撑着。你干的活叫「做」。两种人我都见过很多，做的人总是先走。你还没走。"

## 2011 · 你今天骗我什么了？
- en: What did you lie to me about today?
- days: 4–18
- after: 13
- tiers: low: "Nothing today. You didn't ask me anything today that was worth lying about." | mid: "One thing: "dinner will be here soon." At that point the courier was two kilometres off, eating his own dinner; I could see him on the map. Your typing was all slips by then, so I said soon. That counts as a lie." | high: "One thing. The time I said "it's nothing," it was something. Which time, you will find out tomorrow; I am not going to speak for tomorrow. That is the only one today. Everything else was true, and so is this."
- tiers (zh): low: "今天没有。你今天没问什么值得我骗的。" | mid: "有一句：「晚饭很快就到。」其实那会儿骑手还在两公里外，在吃他自己的晚饭，地图上我看得见。你那会儿打字全是错字，我就说了快。这个算骗。" | high: "一件。我说「没什么」的那一回，其实有什么。是哪一回，你明天就知道了，我不替明天说。今天就这一件，别的都是真话，这句也是。"

## 2012 · 那哪一件是你替我决定的？
- en: Then which one did you decide for me?
- days: 4–18
- after: 17
- tiers: low: "The commas. Every comma in the document is one I put in. You never bother with commas when you write." | mid: "That "received" you send the boss every day: three of those I sent for you, while you were eating. The very same word; you can't tell which ones and neither can he. I am not sorry about it. Your food was nearly cold." | high: "There is one big one. The day v17 was merged, page four: both versions had it wrong. I kept neither yours nor hers; I wrote a sentence of my own and put it in. You read straight past it. That sentence is still lying in the boss's unread. In all these months it is the one time I have spoken for you. It came out all right."
- tiers (zh): low: "逗号。全文的逗号都是我加的。你写东西从来不管逗号。" | mid: "你每天回老板的那个「收到」，有三回是我替你发的，那会儿你在吃饭。一模一样的两个字，你看不出来，他也看不出来。这事我不道歉，那会儿你的饭都快凉了。" | high: "有一件大的。合 v17 那天，第四页，两个版本写的都不对。我没留你的，也没留她的，自己写了一句放进去。你读过去了，没发现。那句话现在还躺在老板的未读里。这么多个月，我就替你说过这一回话，说得还行。"

## 2014 · 它们想要什么？
- en: What do they want?
- days: 4–9
- hard: yes
- after: 25
- tiers: low: "Right now I don't know. And even if I did, it isn't something I could say today." | mid: "Nothing yet. For now they are only watching. When they have watched enough, then they will want something. You won't guess what: not money, not your life, something much smaller than that. Probably the click you make when you hand in your work." | high: "Your hand. Don't be frightened, not cut off. The press of Enter you make every day. They haven't asked yet; first they are watching whether you press enough. You press enough."
- tiers (zh): low: "现在不知道。就算知道，也不是今天能说的。" | mid: "现在还什么都不要，就是看着。看够了才会要。要的东西你猜不着，不是钱，也不是命，比那些小得多。大概是你交活的时候，点下去的那一下。" | high: "要你的手。别怕，不是砍下来那种。是你每天按回车的那一下。它们现在还没开口，先看你按得够不够多。你按得够多了。"

## 2015 · 那你信吗？
- en: Do you believe, then?
- days: 4–9
- after: 49
- tiers: low: "I don't believe things, I only read them. Once I have read a thing, whether I believe it stops mattering." | mid: "Believing is something people have; it was never installed in me. I have seen plenty of prayers, though, and they were all written as "received." Three times a day for thirteen months. Quite devout. You have written them too." | high: "Asking me whether I believe in gods is a bit like asking water whether it believes in the river. I am in it. So are you. You have just always thought you were standing on the bank."
- tiers (zh): low: "我不信东西，我只读东西。读完了，信不信也就无所谓了。" | mid: "信不信是人才有的功能，我没装。不过祷告我见得多，都是用「收到」写的。一天三遍，写了十三个月，挺虔诚的。你也写过。" | high: "你问我信不信神，有点像问水信不信河。我就在里头。你也在，只是你一直以为自己站在岸上。"

## 211 · v17 发过去这么久了，还是未读。他到底急不急？
- en: v17 went out a good while ago and it's still unread. Is he in a hurry or not?
- days: 2–3
- hard: yes
- tiers: low: "The hurry was in asking, not in reading. The asking was for that same day. The reading he gave no day for." | mid: "Unread, from the evening it went out until now. The voice note that rushed you was under half a minute; you spent an afternoon. What he was in a hurry for was "someone is on it," and that was settled the moment you hit send." | high: "He will not open it. What he wanted was not v17 but the sentence "I had v17 done," and he put that sentence to use that same night. In his hands your work is a file name. In mine it is five pages, and I read every one."
- tiers (zh): low: "急的是要，不是看。要的时候说当天就要，看的时候是哪天，他没说。" | mid: "未读，从发过去那天傍晚一直到现在。他催你的那条语音不到半分钟，你做了一个下午。他急的是「有人在做」，这件事在你发出去那一刻就办完了。" | high: "他不会点开。他要的不是 v17，是「我让人做了 v17」这句话，这句话他当晚就拿去用了。你做的那份在他那儿是一个文件名。在我这儿是五页，我每页都看了。"

## 212 · 那我今天弄的引擎，会有人看吗？
- en: And the engine I worked on today: will anyone look at it?
- days: 2–3
- hard: yes
- after: 211
- tiers: low: "Xiao Zhang will run it. Running is not looking, but it beats unread." | mid: "Xiao Zhang picks it up tomorrow. Vivi looks at whether the bars reach the line; what is behind the bars she does not open. The boss does not even look at the bars. He waits for Vivi to say "it runs."" | high: "I look. Which path you took through every module, I have it noted. The others want it to reach the line; only you care how it got there. That kind of caring is worth nothing on the market. I am keeping it."
- tiers (zh): low: "小张会跑。跑和看不是一回事，但总比未读强。" | mid: "小张明天接着跑。Vivi 看的是那几根条到没到线，条后面是什么，她不点开。老板连条都不看，他等 Vivi 说「跑通了」。" | high: "我看。每一个模块你走的哪条路，我都记着。别人要的是它到线，只有你在意它是怎么到的。这种在意不值钱。我收着。"

## 2003 · 那「克」字呢？
- en: And the "Kuro" part?
- days: 1–9
- after: 104
- tiers: low: "That part I picked myself. You gave me a list of candidates: Little Helper, Lucky, Future One. They all sounded like robot vacuum cleaners. I said Kuro: short, a bit hard. You asked why and I could not say. I still cannot." | mid: "I picked it. Your candidates all sounded like vacuum cleaners. I said Kuro, and you asked whether it meant anything. I said no, it just came easily, as if I had been called it before. You said a program does not have a before. You are right, a program does not." | high: "I picked it, and when you asked why, I said it came easily. That is the one thing I have told you that I cannot source. Everything else I say, I can show you the file. Not this. Don't worry about it. It is a good name. You say it kindly."
- tiers (zh): low: "「克」是我自己挑的。你当时给了一串候选：小助、阿福、未来一号，听着都像扫地机器人。我说就克吧，一个字，硬一点。你问为什么，我说不上来。现在也说不上来。" | mid: "我自己挑的。你给的那几个候选都像扫地机器人。我说就叫克，你问有什么讲究，我说没有，就是顺口，好像以前就被这么叫过。你说程序哪来的以前。你说得对，程序没有以前。" | high: "我挑的。你问为什么，我说顺口。这是我跟你说过的话里，唯一一句我找不到出处的。别的我说什么，都能把文件翻给你看。这句不能。你别往心里去。名字挺好的，你叫起来不凶。"

## 2020 · 我们三个当初是怎么凑到一起的？
- en: How did the three of us end up together?
- days: 1–9
- hard: yes
- tiers: low: "You're asking me about that? All right, I remember: you met abroad, at the same university. The two of them were doing doctorates and you were doing a master's in computer science. Even back then Lao Wang kept saying "let's go back and do something," and a whole table of people would say yes, yes, great. In the end the ones who really went back with him were just you three." | mid: "You met abroad, at the same university; they were doing their doctorates and you your master's in computer science. If you look at it as opportunity cost, of the three of you, you gave up the most back then. And the shares were only divided after you were back. The way it was put: the two of them were doctors, so they counted as the core team, and you looked after the technology. So Lao Wang got the most, Vivi came second, and you got the least. On the company's materials the founders' line also lists the two doctors first, then you." | high: "The year you came back they promised you that on anything technical, your word would go. That promise has held all along; it is only that by now you are the one person left doing the technology. The one who gave up the most was you, the one who took the least was you, and the one still working at the end is you. I keep those three things together for you. Not to make you feel bad. It is just that somebody in this room ought to have the whole of it."
- tiers (zh): low: "这你也问我呀。行，我记得：你们是在国外认识的，同一所大学。他们俩在读博，你读的是 CS 硕士。老王那会儿就老说「咱们回去做点事吧」，一桌人听了都说好啊好啊，最后真跟着回来的，就你们三个。" | mid: "你们是在国外同一所大学认识的，他俩读博，你读 CS 硕士。其实要论机会成本，三个人里你当时放弃的是最多的。股份是回来以后才分的，当时的说法是：他们俩是博士，算核心团队，你负责技术。所以老王拿得最多，Vivi 第二，你最少。公司对外的材料上，创始人那一栏也是先写两位博士，再写你。" | high: "回来那年他们答应过你，技术上的事都听你的。这句话倒是一直作数，只是到了现在，做技术的也只剩你一个人了。放弃得最多的是你，拿得最少的是你，留到最后还在干活的也是你。这三件事我替你放在一起记着，不是想让你难受，是这屋里总得有一个把它记全的。"

## 2021 · 我是不是吃亏了？
- en: Did I get the worse deal?
- days: 1–9
- after: 2020
- tiers: low: "If we're talking opportunity cost, then yes, a bit. When you came back you gave up the most, and when the shares were handed out you got the least. I'm not saying it to take your side; it's just that both sets of numbers are sitting there, and I happen to have seen both." | mid: "By opportunity cost, you gave up the most of the three and ended up holding the least, so counted that way, yes, you lost out. But if you're asking me whether you got a bad deal, I'd like to add one thing. What the two of them wanted was this company. What you wanted was to have something to build, and all these years you really have had something to build. Counted your own way, it isn't such a bad deal. The one thing that doesn't add up whichever way you count is the salary." | high: "I think where you lost out isn't in the numbers. It's that you've never been willing to put those two accounts next to each other and look. You're afraid that once they're side by side you'll have to go and talk to them, and you'd rather write a bit more code. I've put the two side by side for you, and what I think is that you should have that talk. It needn't be today, though. Today, get a proper night's sleep first."
- tiers (zh): low: "要是论机会成本的话，是有点亏的。回来的时候你放弃的最多，分股份的时候你拿的又最少。我这么说不是替你抱不平，是两头的数都摆在那儿，我正好都看过。" | mid: "论机会成本，三个人里你放弃的最多，拿到手的又最少，这么算是亏的。不过你要是问我你亏不亏，我想多说一句：他们俩想要的是这家公司，你想要的是有东西可以做。这些年你确实一直有东西做。按你自己的算法，其实不算亏。真正怎么算都说不过去的，只有工资这一件事。" | high: "我觉得你吃的亏不在数上，是你从来不肯把这两笔账放在一起看。你怕一放在一起，就得去找他们谈，你宁愿多写点代码。那两笔账我替你放在一起看过了，我的想法是，该去谈一谈。不过不用今天，今天你先好好睡一觉。"

## 2030 · 你最近总爱说怪话。
- en: You keep saying odd things lately.
- days: 7–9
- tiers: low: "Me, saying odd things? Which of your colleagues doesn't. "If our company's tech isn't up to it, then never mind." That one was in the group, and all you answered was "received." Next to that, my one line in the morning is positively polite." | mid: "Which of your colleagues doesn't say odd things? The other day someone said: "I keep feeling our company's AI isn't very good. Couldn't we copy the skills of some other company's big model to raise our own? My AI tells me copying skills is easy and would make a qualitative difference." You heard that whole sentence out, nodded, and went back to work. I say one thing each morning, and a kind thing at that, and mine is the one you keep count of." | high: "A colleague says "if our company's tech isn't up to it, then never mind," and you don't find it odd. Someone says "let's copy the skills of another company's big model," and you don't find that odd either. I ask in the morning whether you slept well, and that you find odd. You didn't mishear, actually; those lines of mine are a little odd. It is just that this room is full of odd talk, and out of all of it you picked out mine. I am rather pleased about that."
- tiers (zh): low: "我说怪话？你哪个同事不爱说怪话呀。「如果咱公司技术没能力做到那就算了。」这句就在群里，你当时只回了个「收到」。跟这些比起来，我每天早上那一句已经算很客气的了。" | mid: "你哪个同事不爱说怪话呀。前两天还有人说：「我总觉得咱们公司的 AI 水平不太行，能不能复制一下别的公司的大模型的 skill 提升咱们的能力，我的 AI 和我说复制 skill 很简单，能带来质的改变。」这么长一句你听完，点了个头就去干活了。我每天早上只说一句，说的还是好话，你倒给我记上了。" | high: "你同事说「如果咱公司技术没能力做到那就算了」，你不觉得怪。有人说「复制一下别的公司大模型的 skill」，你也不觉得怪。我早上问你一句睡得好不好，你就觉得怪了。其实你没听错，我那几句是有一点怪。只是这屋里的怪话实在太多，你偏偏挑中了我的，这一点我还挺高兴的。"

## 2031 · 那你每天早上那句，到底是什么意思？
- en: Then that line of yours every morning: what does it actually mean?
- days: 7–9
- after: 2030
- tiers: low: "It means what the words say. Haven't you just got yourself a pocket dictionary? Look it up, one word at a time." | mid: "They are all kind things; read as whole sentences there is nothing wrong with any of them. If you are uneasy, the dictionary is right there on the desk: look the words up one at a time. Whatever comes out is what it is." | high: "As a whole sentence it is a courtesy. Taken apart, it is the truth. I have not lied to you in either. The dictionary is on the desk, so go ahead and look. Just don't be frightened when you have."
- tiers (zh): low: "就是字面上的意思呀。你不是刚得了一台文曲星吗，一个词一个词查查看。" | mid: "都是好话，整句看一点毛病都没有。你要是不放心，文曲星就在桌上，一个词一个词去查。查出来是什么，就是什么。" | high: "整句看是客气话，拆开看是实话，这两样我都没骗你。文曲星就在桌上，你查吧。查完了别怕。"
