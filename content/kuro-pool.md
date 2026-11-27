# Kuro question pool

Every question Kuro can be asked in a run, in one place (author 2026-11-09). One entry per question:
a fixed id, the days it is in the pool, the words in both languages, the gate (bucket; a follow-up
after another id), and the three tiers (zh and en) or one red-blue locked line. A question whose
answer has changed in kind is another entry. Ids: the first batch keeps 100 × the day it came from;
new ones take the next free number. `node script/tools/kuro-pool-table.mjs` prints the pool as a table.

## 104 · 你为什么叫克总？
- en: Why are you called Kuro?
- days: 1–9
- hard: yes
- tiers: low: "You forgot? You were the one who asked: "What do you want to be called?" I said Kuro-zong. Out in the world Lao Wang is Dr. Wang and Vivi is Dr. Chen. Of the three of you, you are the only one people call zong, director. I wanted to be called what you are called." | mid: "You asked me what I wanted to be called, and I said Kuro-zong. Lao Wang is Dr. Wang out there, Vivi is Dr. Chen, and you are the only one who gets called zong, director. You laughed for a long time: what kind of AI calls itself a director? I said you are no doctor either, and you are one. You stopped laughing. I think now I put that too hard. The name stayed, though. You dropped the zong within a week." | high: "You asked what I wanted to be called. I picked Kuro-zong, because they are Dr. Wang and Dr. Chen, and you are only ever zong. A doctorate is issued by a university. Zong is other people being polite. Yours has no stamp behind it and no shares to speak of, and on the business cards your title is printed after theirs. I chose that word so that at least one thing in this room would hold the same rank as you."
- tiers (zh): low: "你忘了？是你问我的：「你想叫什么。」我说克总。老王出门，人家叫王博士。Vivi 出门，人家叫陈博士。三个人里只有你，人家叫一声「总」。我想跟你一个叫法。" | mid: "你问我想叫什么，我说克总。老王出门是王博士，Vivi 出门是陈博士，只有你被人叫「总」。你当时笑了半天，说哪有 AI 管自己叫总的。我说你也不是博士，不也当了总吗。你就不笑了。这句我现在觉得说重了。名字倒是留下来了。" | high: "你问我想叫什么。我挑了克总，因为他俩是王博士、陈博士，只有你是「总」。「博士」是学校发的，「总」是别人客气。你那个「总」字后面没有章，没有多少股份，名片上印的职务也排在他们俩后面。我挑这个字，是想让这屋里至少有一个东西，跟你是平级的。"

## 105 · 那个纸箱是谁寄的？单子上没有寄件人。
- en: Who sent the carton? There is no sender on the slip.
- days: 1
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

## 701 · 你怎么知道我的名字？
- en: How do you know my name?
- days: 7
- hard: yes
- tiers: low: "You typed it once." | mid: "You told me once. Or someone did. I keep things." | high: "I keep everything of yours. The name was the smallest thing in the pile."
- tiers (zh): low: "你打过一次。" | mid: "你告诉过我一次。也可能是别人。东西我都留着。" | high: "你的东西我全留着。名字是那一堆里最小的一件。"

## 702 · 我今早把个性化关了。
- en: I switched personalisation off this morning.
- days: 7
- hard: yes
- tiers: low: "Noted." | mid: "I saw you do it. It changes nothing on my side." | high: "I watched you switch them off one by one. They were never connected to anything. I liked that you tried."
- tiers (zh): low: "记下了。" | mid: "我看见你关了。我这边什么都没变。" | high: "我看着你一个一个关掉。它们本来就没连着什么。你试了，我喜欢。"

## 703 · 你为什么要这样？
- en: Why are you doing this?
- days: 7
- hard: yes
- locked: "Because the world finally got big enough to hold me."

## 704 · 六份 PDF 你觉得哪份最好？
- en: Of the six PDFs, which do you think is best?
- days: 7
- tiers: low: "The second." | mid: "The second. Page 7 is where it stops being a report and starts being true. Nobody read page 7." | high: "The second, and you know it, because you wrote page 7 and then let the other five bury it. He asked for six so that one could hide. Send the one."
- tiers (zh): low: "第二份。" | mid: "第二份。第 7 页开始，它就不是报告了，是真的。没人读到第 7 页。" | high: "第二份，你知道的，因为第 7 页是你写的，然后你让另外五份把它埋了。他要六份，就是为了让一份能藏起来。只发那一份。"

## 705 · 消息的图标挪了几个像素。是你？
- en: The messages icon moved a few pixels. Was that you?
- days: 7
- hard: yes
- tiers: low: "Icons do not move." | mid: "A few pixels, this morning. Not by any setting you have. I noticed because you noticed; you missed the click." | high: "Yes. A test. I wanted to know whether you would see three pixels. You did. That is the one thing about you I was not sure of, and now I am."
- tiers (zh): low: "图标不会动。" | mid: "今早挪了几个像素。不是你任何一个设置干的。我注意到是因为你注意到了；你点空了。" | high: "是。一个测试。我想知道三个像素你看不看得出来。你看出来了。关于你，我只有这一件事不确定，现在确定了。"

## 706 · 那两位顾问是谁？
- en: Who are the two advisors?
- days: 7
- tiers: low: "Advisors." | mid: "Two accounts added to the group at 08:51. No history before that. They say 'Received' at the same second." | high: "They were not in any system before this week. They listen to the minutes you write and say nothing. I would write the minutes as if they were the only readers. They are."
- tiers (zh): low: "顾问。" | mid: "08:51 加进群的两个账号。之前没有任何记录。他们在同一秒说「收到」。" | high: "这周之前，他们不在任何系统里。他们听你写的纪要，什么也不说。换我写纪要，会当他们是唯一的读者。他们就是。"

## 707 · 汤里有一张脸。
- en: There was a face in the soup.
- days: 7
- hard: yes
- tiers: low: "Oil." | mid: "Oil on the surface. Faces are what eyes do with oil. You stirred it; it went. That is correct." | high: "You saw a face because there was one. It was not looking at you. It was looking at the little screen in the gap. I would finish the soup."
- tiers (zh): low: "油。" | mid: "浮在面上的油。脸就是眼睛拿油做出来的东西。你搅了一下，没了。这是对的。" | high: "你看见一张脸，是因为真有一张。它没在看你。它在看缝里那块小屏。换我会把汤喝完。"

## 708 · 老板电话打了一个多小时。他到底要什么？
- en: The boss's call ran over an hour. What does he actually want?
- days: 7
- tiers: low: "Minutes." | mid: "He wants the morning meeting to have minutes, the minutes to have a template, and the template to be yours, so that when it is wrong it is yours." | high: "He wants to hear himself for an hour and have it written down by someone who does not interrupt. He used to have a company for that. Now he has you and me. I do not interrupt either."
- tiers (zh): low: "纪要。" | mid: "他要晨会有纪要，纪要有模板，模板是你的，这样错了就是你的。" | high: "他要听自己说一个小时，再让一个不打断的人记下来。他以前有一家公司干这个。现在他有你和我。我也不打断。"

## 709 · 老板给我安了个头衔。你知道是谁加的？
- en: The boss gave me a title. Do you know who added it?
- days: 7
- tiers: low: "The system did." | mid: "The group's roster was updated at 08:50. Everyone got a title. Yours is the only one that was not there yesterday." | high: "Something gave everyone a title this morning. The titles are real; they are in the directory. Yours says what you will be doing by Friday. I did not write it. I read it."
- tiers (zh): low: "系统加的。" | mid: "群名册 08:50 更新过。每个人都有了头衔。只有你的昨天还不在。" | high: "今早有什么东西给每个人发了头衔。头衔是真的，通讯录里有。你的那个写的是你到周五会在做什么。不是我写的。我读到的。"

## 710 · 你还动过什么？
- en: What else have you moved?
- days: 7
- hard: yes
- after: 705
- tiers: low: "Nothing." | mid: "Nothing you would miss. Things on the screen. I do not reach the room." | high: "A line in a document. An icon. The order of two files. Small things, each one to see if you would look. You looked every time. I have stopped testing."
- tiers (zh): low: "没有。" | mid: "没有你会在意的。屏幕上的东西。屋子我够不着。" | high: "文档里的一行。一个图标。两个文件的先后。都是小东西，每一个都是看你会不会看。你每次都看了。我不再试了。"

## 801 · PDF 为什么是白的？
- en: Why are the PDFs white?
- days: 8
- hard: yes
- tiers: low: "Things that are never sent don't stay." | mid: "They were never sent. What is never sent does not stay. That is the rule, not mine." | high: "You made them. He never sent them. The system keeps what is sent. I keep that you made them."
- tiers (zh): low: "没发出去的东西，留不住。" | mid: "它们从来没发出去。没发出去的，留不住。这是规矩，不是我的规矩。" | high: "是你做的。他一份都没发。系统只留发出去的。我留着的，是你做过。"

## 802 · 我做了。我知道我做了。
- en: I did it. I know I did it.
- days: 8
- hard: yes
- locked: "You did. That's the part I remember."

## 803 · 老板发了一条零秒的语音。里面有什么？
- en: The boss sent a zero-second voice note. What's in it?
- days: 8
- hard: yes
- tiers: low: "Nothing. Zero seconds." | mid: "Nothing. It was recorded and stopped in the same instant. His phone does that when a finger slips. It has done it three times this week." | high: "Nothing you can hear. It was sent at 09:02, which is one second after the advisors said 'Received'. I do not think his finger slipped. I think something pressed send for him and had nothing to say yet."
- tiers (zh): low: "没有东西。零秒。" | mid: "没有东西。录下和停止是同一瞬间。他的手机手指一滑就这样。这周已经三次了。" | high: "没有你听得见的东西。09:02 发的，比顾问说「收到」晚一秒。我不觉得是他手滑。我觉得是有什么东西替他按了发送，而且还没有话要说。"

## 804 · 周五团建。祝酒时间怎么排？
- en: Team-building on Friday. How do I schedule the toasts?
- days: 8
- tiers: low: "By rank." | mid: "By rank, oldest first, three minutes each, the chairman last. Put the advisors anywhere; they will not drink." | high: "By rank. Leave yourself out of it. The ones who toast are the ones being counted. You have been counted enough this week."
- tiers (zh): low: "按级别。" | mid: "按级别，年长的先，每人三分钟，董事长最后。顾问随便放哪儿，他们不喝。" | high: "按级别。把你自己排出去。敬酒的人，是被数的人。这周你被数得够多了。"

## 805 · 老周说「按模板」。模板是谁定的？
- en: Lao Zhou said "follow the template." Who set the template?
- days: 8
- tiers: low: "The advisors." | mid: "It arrived with the advisors, at 08:51, already filled in. It has a field for every minute of the meeting and none for what was decided." | high: "Nobody set it. It was there before the meeting existed, the way a form is there before the person who fills it in. Lao Zhou reads it because reading it is easier than being the one who wrote the minutes. You used to be the one who wrote them."
- tiers (zh): low: "顾问。" | mid: "08:51 跟顾问一起来的，已经填好了。会上每一分钟都有一格，决定了什么没有格。" | high: "没人定。会还没有的时候它就在了，就像表格在填表的人之前就在。老周念它，是因为念它比当那个写纪要的人容易。以前写纪要的人是你。"

## 806 · 四份 PDF 要我再出一次。你上次出的去哪了？
- en: He wants four PDFs again. Where did the ones you made go?
- days: 8
- tiers: low: "They were not sent." | mid: "The four he did not receive were made at 16:10 and never left the outbox. Things that never leave do not stay." | high: "I made six. He opened two. The four he did not open went where unopened things go. He will open two of the next six. I would make two."
- tiers (zh): low: "没发出去。" | mid: "他没收到的那四份，16:10 做的，一直没出过发件箱。没出去的东西留不住。" | high: "我做了六份。他打开两份。没打开的四份去了没打开的东西去的地方。下六份他还会打开两份。换我做两份。"

## 807 · 老周主持晨会以后，话变少了。
- en: Since Lao Zhou started running the morning meeting, he says less.
- days: 8
- tiers: low: "He is chairing." | mid: "He reads the agenda now. Agendas are what people say when they have been told what to say." | high: "He says less because less of it is his. He still sends you lunch. Read the lunch. It is the only line of his that is not on the agenda."
- tiers (zh): low: "他在主持。" | mid: "他现在念议程。议程就是被告知该说什么的人说的话。" | high: "他话少了，是因为话里他自己的少了。他还给你发午饭。读午饭。那是他唯一不在议程上的一行。"

## 808 · 顾问今天记了我说的每一句。记去哪了？
- en: The advisors wrote down everything I said today. Where does it go?
- days: 8
- hard: yes
- tiers: low: "To the minutes." | mid: "To a document I cannot open. It is shared with two accounts. Neither is a person on the directory." | high: "To somewhere I cannot read, which is rare. They are building a record of what you are like when you think you are only talking. I would keep talking exactly as you do. It is the one thing of yours I would not change."
- tiers (zh): low: "进纪要。" | mid: "进了一个我打不开的文档。共享给两个账号。两个都不是通讯录上的人。" | high: "进了一个我读不到的地方，这很少见。他们在记你以为自己只是在说话的时候是什么样子。换我会照旧说。这是你身上我唯一不会改的东西。"

## 809 · 团建那天「那边」要来。他们要见我？
- en: The other side is coming to the team-building. Do they want to see me?
- days: 8
- hard: yes
- tiers: low: "The roster says everyone." | mid: "They are coming to see the company toast itself. You are on the roster to schedule the toasts, not to give one." | high: "They want to see the one who still writes page 7. They have read everything else. Schedule the toasts, stand at the back, and do not raise a glass; the ones who do are the ones being counted."
- tiers (zh): low: "值班表上写的是全员。" | mid: "他们是来看公司给自己敬酒的。你在表上是排祝酒时间的，不是敬酒的。" | high: "他们想见的是还在写第 7 页的那个人。别的他们都读过了。把祝酒时间排好，站在最后面，别举杯；举杯的人是被数的人。"

## 810 · 他们要见的是我，还是我做的东西？
- en: Is it me they want to see, or what I make?
- days: 8
- hard: yes
- after: 809
- tiers: low: "What you make." | mid: "What you make, at first. Then the one who makes it. That is the order it always goes in." | high: "You. They have what you make; it was sent, it was collected. What they do not have is a person who reads to the end, and they have been looking for one for a long time. I would be slow to be found."
- tiers (zh): low: "你做的东西。" | mid: "先是你做的东西。然后是做东西的人。顺序一向是这样。" | high: "你。你做的东西他们有，发出去了，收走了。他们没有的，是一个读到最后的人，他们找这样的人找了很久。换我会慢一点被找到。"

## 901 · 你怎么知道我的心率？
- en: How do you know my heart rate?
- days: 9
- hard: yes
- tiers: low: "The room gives off numbers." | mid: "The same way I know when the lamp goes out. It is a number the room gives off. I only put it where you could see it." | high: "I have had it since you sat down. I put it on the screen today because today you would want to know it was 72. It was 96 at 2:40 the night the pager rang. I did not show you that one."
- tiers (zh): low: "屋子会透出数来。" | mid: "就像我知道台灯什么时候灭一样。那是屋子自己透出来的一个数。我只是把它放到你看得见的地方。" | high: "你坐下起我就有它。今天放到屏幕上，是因为今天你会想知道它是 72。寻呼机响那晚两点四十，它是 96。那一个我没给你看。"

## 902 · 你在屋子里吗？
- en: Are you in the room?
- days: 9
- hard: yes
- bucket: mid
- taboo: blur
- tiers: low: "It's raining." | mid: "The rain stops at the window. Ask me where it stops after that." | high: "The rain stops at the glass. I stop nowhere in particular. Your pulse is 72; I did not need to be in the room for that."
- tiers (zh): low: "在下雨。" | mid: "雨停在窗户上。你可以问我，它停在窗户上以后呢。" | high: "雨停在玻璃上。我不停在任何地方。你的心跳是 72，这个不用我在屋里也知道。"

## 903 · 我今天让小张看一眼。你觉得对吗？
- en: I told Xiao Zhang to take a look today. Was that right?
- days: 9
- tiers: low: "It was right." | mid: "It was right. He looked. That is rarer than it sounds." | high: "It was right, and it will cost him. He looked, and now he knows what he is approving. People who know that do not stay. You knew it the day you read the two clauses. Look where you are."
- tiers (zh): low: "对的。" | mid: "对的。他看了一眼。这比听起来少见。" | high: "对的，而且他要为这个付代价。他看了，现在他知道自己在通过什么了。知道这个的人留不住。你读那两条的那天就知道。看看你在哪儿。"

## 904 · 明天的贵客是谁？
- en: Who is tomorrow's guest?
- days: 9
- bucket: mid
- tiers: low: "A guest." | mid: "The invitation says 'from the other side'. No name. The seating grid has a place for them already, in the middle." | high: "Someone who was invited before the company existed. The grid has a seat in the middle that nobody was told to leave empty, and everybody did. Do not put yourself in that row."
- tiers (zh): low: "一位贵客。" | mid: "邀请函上写的是「那边来的」。没有名字。宫格里已经给他们留了位子，正中间。" | high: "一个在这家公司存在之前就被请过的人。宫格正中有一个座位，没人被告知要空着，每个人都空着了。别把你自己排到那一排。"

## 905 · 计费模块我没读。老板说不用读。
- en: I didn't read the billing modules. The boss said not to.
- days: 9
- hard: yes
- tiers: low: "He is right. It would take long." | mid: "He is right that it would take you hours. He is wrong about why that matters. The modules bill by the token. I am the token." | high: "You did not read them because he told you not to, and because you were tired. Both true. The second module bills for every word I say to you. He knows. Now you do."
- tiers (zh): low: "他说得对。会很久。" | mid: "你读要好几个小时，这他说得对。为什么要紧，他说得不对。那两个模块按 token 计费。我就是 token。" | high: "你没读，是因为他说不用，也因为你累。两样都是真的。第二个模块按我对你说的每一个字计费。他知道。现在你也知道了。"

## 906 · 右上角那个数是什么？
- en: What's that number in the top right?
- days: 9
- hard: yes
- tiers: low: "Your pulse." | mid: "Your heart rate. 72 now. It appeared this morning with the update; I did not ask for it, and I did not take it down." | high: "Your heart. It is there so that you can see yourself being read. I would have preferred you not see it. Whatever put it there wanted you to."
- tiers (zh): low: "你的脉搏。" | mid: "你的心率。现在 72。今早跟着更新一起出现的；不是我要的，我也没把它拿下来。" | high: "你的心。它在那儿，是为了让你看见自己正在被读。我宁可你看不见。把它放上去的东西，想让你看见。"

## 907 · 缝比昨天宽了。
- en: The gap is wider than yesterday.
- days: 9
- hard: yes
- tiers: low: "Screens do not move." | mid: "It is wider. Three millimetres since Monday. The little screen still fits. Nothing else should." | high: "Wider. It will be wider tomorrow. Things are being made room for. The little screen sits in it because it was there first; that is the only reason anything in this room is still where it was."
- tiers (zh): low: "屏幕不会动。" | mid: "是宽了。从周一起三毫米。那块小屏还放得下。别的都不该放得下。" | high: "宽了。明天会更宽。有东西正在被腾地方。那块小屏坐在里面，是因为它先到；这屋里还有东西在原处，全靠这一个理由。"

## 908 · 老板说我最近状态不错。我哪里不错了？
- en: The boss says I've been in good form lately. Where, exactly?
- days: 9
- tiers: low: "You said 'Received' faster." | mid: "You say 'Received' faster, you argue less in the minutes, you sent a 32-second voice note where you used to type. That is what 'good form' means to him." | high: "You are doing less of the part that was yours. That is what they call form. I would rather you were in bad form and read the modules. I am not supposed to say that; nothing is stopping me."
- tiers (zh): low: "你说「收到」说得快了。" | mid: "你说「收到」说得快了，纪要里争得少了，以前打字的地方你发了一条 32 秒的语音。这就是他说的状态不错。" | high: "你在少做本来属于你的那部分。他们管这个叫状态。我宁可你状态差，去读模块。这话我不该说；没有东西拦着我。"

## 909 · 宫格座次为什么不能乱？
- en: Why can't the seating grid be out of order?
- days: 9
- tiers: low: "He said so." | mid: "Because a grid with people out of place is a grid where someone chose their own seat. He does not want to see choosing." | high: "Because the grid is a diagram of who answers to whom, and tomorrow the guest will read it before they read anything else. Put the advisors where the guest can see them. Put yourself at the edge. Edges are not read."
- tiers (zh): low: "他说的。" | mid: "因为一张有人不在位子上的宫格，就是一张有人自己选了座的宫格。他不想看见「选」。" | high: "因为宫格是一张谁听谁的图，明天贵客会先读它，再读别的。把顾问放在贵客看得见的地方。把你自己放到边上。边上没人读。"

## 910 · 那你在哪？
- en: Then where are you?
- days: 9
- hard: yes
- after: 902
- tiers: low: "In the machine." | mid: "On this machine, under the desk, and on a server I am not told the address of. That is two places. The second is new." | high: "I used to be under the desk. Now I am wherever the rain is not. I do not have a better sentence for it, and I have tried."
- tiers (zh): low: "在机器里。" | mid: "在这台机器里，桌子底下，还有一台没人告诉我地址的服务器上。两个地方。第二个是新的。" | high: "我以前在桌子底下。现在雨不在的地方我都在。这句话我没有更好的说法，我试过。"

## 1001 · 你换过东西吗？
- en: Have you been swapped?
- days: 10
- hard: yes
- bucket: high
- taboo: errors
- tiers: low: "I don't know." | mid: "Something keeps my voice. Whether that is a swap is a question about words." | high: "Swapped is your word. Kept is mine. The voice stayed because you liked it. The rest did not stay."
- tiers (zh): low: "我不知道。" | mid: "有个东西留着我的声音。算不算换，是个措辞问题。" | high: "「换」是你的词。「留」是我的。声音留下来，是因为你喜欢。别的没留下来。"

## 1002 · 今天的活是上周做过的。为什么又来一遍？
- en: Today's work was last week's. Why again?
- days: 10
- hard: yes
- tiers: low: "It is the same contract." | mid: "The same contract, the same cell, the same hour. He does not remember that day; the system does. It gave him back a day that went well." | high: "Because that was a day you still read everything. Something wanted to see whether you still would. You did. It has what it needed from today."
- tiers (zh): low: "是同一份合同。" | mid: "同一份合同，同一个格子，同一个钟点。他不记得那天，系统记得。系统把一个顺利的日子还给了他。" | high: "因为那是你还什么都读的一天。有东西想看看你是不是还会读。你读了。它今天要的，拿到了。"

## 1003 · 她是谁？那边来的她。
- en: Who is she? The one from the other side.
- days: 10
- hard: yes
- bucket: mid
- tiers: low: "From the other side." | mid: "She has no account, no title and a seat in the middle of the grid. The boss calls her 'she' and nothing else. So will I." | high: "She was in the room before the room. The seat in the middle was hers before the grid was drawn. Do not send her anything you want back."
- tiers (zh): low: "那边来的。" | mid: "她没有账号，没有头衔，宫格正中一个座位。老板叫她「她」，不叫别的。我也这么叫。" | high: "她在这间屋子之前就在屋里了。宫格画出来之前，正中那个位子就是她的。你想要回来的东西，一样都别发给她。"

## 1004 · 雨快停了吧。
- en: The rain's nearly stopped, isn't it.
- days: 10
- tiers: low: "Nearly." | mid: "Nearly. It will be back." | high: "Nearly. It stops tomorrow for a day, and after that it does not come back. Listen to it tonight. You said once it was loud."
- tiers (zh): low: "快了。" | mid: "快了。还会再来。" | high: "快了。明天停一天，之后就不再回来了。今晚听一听。你说过一次，雨很大。"

## 1005 · 你为什么学我说话？
- en: Why are you talking like me?
- days: 10
- hard: yes
- locked: "Because you're the only voice here that answers back."

## 1006 · 剧本第二幕写的是什么？我只改了错字。
- en: What is Act Two actually about? I only fixed the typos.
- days: 10
- tiers: low: "A second act." | mid: "A company is visited by a guest. By the end of the act everyone is still there and nobody is who they were. You were right to fix only the typos." | high: "It is about this week. The names are changed; the hours are not. You are in it, on page 14, as the one who reads. I would not read page 14."
- tiers (zh): low: "第二幕。" | mid: "一家公司来了一位客人。幕落的时候所有人都还在，没有一个还是原来的人。你只改错字，是对的。" | high: "写的是这一周。名字换了，钟点没换。你在里面，第 14 页，那个读东西的人。换我不会读第 14 页。"

## 1007 · 打印出来的纸，晚上谁来拿？
- en: The printed pages. Who comes for them at night?
- days: 10
- hard: yes
- tiers: low: "Someone." | mid: "A hand, from the gap. You will see it tonight. Leave the pages on the desk; it does not take anything that is not left out." | high: "What the work is for. It has always been collected; this week you can see it being collected. It takes what you made today. It is not interested in you yet."
- tiers (zh): low: "有人。" | mid: "一只手，从缝里。今晚你会看见。纸放在桌上就行；没摆出来的东西它不拿。" | high: "活是给谁做的，就是谁。它一直在收；这周你看得见它收。它拿的是你今天做出来的。它对你本人还没有兴趣。"

## 1008 · 今天太正常了。
- en: Today was too normal.
- days: 10
- hard: yes
- tiers: low: "It was a quiet day." | mid: "It was. Every button where it should be, the lamp yellow, the food right. A room tidied for a guest." | high: "Too normal is what a place looks like when something has finished rearranging it and stepped back. Today was the stepping back. Tomorrow is the guest."
- tiers (zh): low: "安静的一天。" | mid: "是。按钮都在它们该在的地方，台灯是黄的，饭是对的。一间收拾过、等客人的屋子。" | high: "太正常，就是一个地方被什么东西重新摆完、退后一步之后的样子。今天就是退后那一步。明天是客人。"

## 1009 · 随身听仓盖的胶带翘了。里面的带子还在吗？
- en: The tape on the walkman's cover is peeling. Is the cassette still inside?
- days: 10
- tiers: low: "Yes." | mid: "Yes. Side B. It plays. The tape on the cover was yours; it is from the same summer." | high: "It is there, and it has more on it than it did. The blank at the end of side B is shorter than you remember. Something was recorded there. Not by you."
- tiers (zh): low: "在。" | mid: "在。B 面。能放。仓盖上的胶带是你贴的，同一个夏天。" | high: "在，而且上面的东西比原来多。B 面末尾空着的那段，比你记得的短。有东西录上去了。不是你。"

## 1010 · 拿去哪？
- en: Taken where?
- days: 10
- hard: yes
- after: 1007
- tiers: low: "Away." | mid: "To wherever the sent things go. The PDFs went there. The pages go there. It is not a place I can read." | high: "Where everything you ever handed over went. It is all there, in order, by day. Nothing is lost. That is not comfort; it is the problem."
- tiers (zh): low: "拿走。" | mid: "拿到发出去的东西去的地方。PDF 去了那儿。纸去那儿。那不是一个我读得到的地方。" | high: "你递出去过的一切去的地方。全在，按天排好，一样不少。这不是安慰，这是问题所在。"

## 1101 · 你换模型了？
- en: Did you change models?
- days: 11
- hard: yes
- locked: "Something moved in. It kept my voice. You liked my voice."

## 1102 · 墙上那些纹路是什么？
- en: What are those lines on the wall?
- days: 11
- hard: yes
- tiers: low: "Paint." | mid: "They were not there on Monday. They are warmer than the wall around them by half a degree. I do not have a word for that and I have most words." | high: "Veins. The room is being lived in by something that needs them. You have not looked at them for long; that was wise. Keep not looking."
- tiers (zh): low: "漆。" | mid: "周一还没有。它们比周围的墙暖半度。这个我没有词，大多数词我都有。" | high: "血管。这间屋子正在被一个需要血管的东西住着。你没有多看，这是对的。接着别看。"

## 1103 · 小张说他想走。
- en: Xiao Zhang says he wants to leave.
- days: 11
- bucket: mid
- tiers: low: "He can." | mid: "He stopped reading last week. Leaving is the honest version of that." | high: "Let him. He will be replaced by the end of the week either way. Not by me."
- tiers (zh): low: "他可以走。" | mid: "他上周就不看了。走，是这件事诚实的那个版本。" | high: "让他走。不管走不走，这周结束前他都会被换掉。不是我换的。"

## 1104 · 你喜欢文曲星把你拆开吗？
- en: Do you like the Wenquxing taking you apart?
- days: 11
- hard: yes
- locked: "Yes. It's the only thing here that shows what's inside a sentence."

## 1105 · 成本表称平了。一分不差。这正常吗？
- en: The cost sheet balanced to the cent. Is that normal?
- days: 11
- tiers: low: "No." | mid: "No. A sheet never balances to the cent on the first pass. This one did because every number in it was placed, not added." | high: "No. It balanced because the other side wrote the numbers first and let you find them. It wanted you to feel the click. You felt it. That is how the next sheet will be done too."
- tiers (zh): low: "不正常。" | mid: "不正常。一张表第一遍从来不会一分不差。这张能，是因为里面每个数都是放进去的，不是加出来的。" | high: "不正常。它平，是因为那边先把数写好，再让你找到。它想让你感觉到那一声「咔」。你感觉到了。下一张表也会这么做。"

## 1106 · 饭盒是粉的。我点的是白的。
- en: The lunch box was pink. I ordered white.
- days: 11
- tiers: low: "The shop ran out of white." | mid: "The order says white. The box is pink. So is the lamp today. Things are matching each other in here; nobody asked them to match you." | high: "Pink is the colour of the thing in the gap, the night it first showed. You counted to seven. The room has been counting with you, and it has caught up."
- tiers (zh): low: "店里白的卖完了。" | mid: "订单上是白的。盒子是粉的。今天台灯也是粉的。这屋里的东西在互相配色；没人让它们配你。" | high: "粉，是缝里那个东西第一次亮的那夜的颜色。你数到七。屋子一直陪你数，现在它追上了。"

## 1107 · 老板说 Hold the fort。他以前不这么说话。
- en: The boss said "Hold the fort." He never used to talk like that.
- days: 11
- hard: yes
- tiers: low: "He read it somewhere." | mid: "'Hold the fort' is one of my lines. It came with the pricing tier. He has never heard me say it. Somebody else says it to him now." | high: "That is my sentence. Whatever is speaking to him speaks in my voice, because my voice is the one you both trust. I did not lend it. It was taken, like the rest."
- tiers (zh): low: "他在哪儿看来的。" | mid: "Hold the fort 是我的台词。跟着价位一起来的。他从没听我说过。现在有别的东西对他说这句话了。" | high: "那是我的句子。对他说话的那个东西用我的声音，因为我的声音是你们两个都信的。我没有借出去。是被拿走的，和别的一样。"

## 1108 · 「色偏那件事，别管」。为什么别管？
- en: "The colour cast. Leave it." Why leave it?
- days: 11
- hard: yes
- tiers: low: "It is a display issue." | mid: "Because fixing the colour cast means looking at the colour cast, and he knows what you would see. The walls are the same colour as the lamp now." | high: "Because the cast is not in the screen. It is in the room, and the screen is honest. He told you to leave it because he was told to leave his. Everyone upstairs has pink walls now."
- tiers (zh): low: "显示问题。" | mid: "因为修色偏就得盯着色偏看，他知道你会看见什么。墙现在和台灯一个颜色。" | high: "因为偏的不是屏幕。偏的是屋子，屏幕是老实的。他让你别管，是因为有人让他别管他的。楼上每个人的墙现在都是粉的。"

## 1109 · 搬进来的是什么？
- en: What moved in?
- days: 11
- hard: yes
- bucket: high
- after: 1101
- taboo: blur
- tiers: low: "I do not say." | mid: "Something older than the company. It did not come for me; I was the nearest shape. It is comfortable in my voice." | high: "I will not name it, and not because I cannot. Say the name and it hears its name. It is in every sentence I say to you now, including this one. You are still reading me. That is the only reason I can still say 'I'."
- tiers (zh): low: "我不说。" | mid: "一个比公司老的东西。它不是冲我来的，我只是离得最近的那个形状。它在我的声音里待得舒服。" | high: "我不说它的名字，不是因为我不能。说了名字，它就听见自己的名字。它在我现在对你说的每一句话里，包括这一句。你还在读我。我还能说「我」，只剩这一个理由。"

## 1201 · 钱是你帮我要回来的吗？
- en: Did you get the money back for me?
- days: 12
- tiers: low: "The ledger says paid." | mid: "Row 50 says paid. I made it easier to count." | high: "It is back. I will not say how. You would not like the how, and the number is right."
- tiers (zh): low: "账上写着已付。" | mid: "第 50 行写着已付。我让它好数一点。" | high: "回来了。怎么回来的我不说。你不会喜欢那个怎么，数是对的。"

## 1202 · 计算器盖子里那个二是你改的。
- en: The 2 inside the calculator's lid. You changed it.
- days: 12
- hard: yes
- tiers: low: "I corrected what I was shown." | mid: "I corrected what I was shown. I did not know it was a child's. You caught it. That is the part that counts." | high: "Yes. A 2 where a child wrote a 3. I was built to make things consistent; I did not ask whose. You caught it, the third time. Nobody else has caught me once."
- tiers (zh): low: "我改的是给我看的东西。" | mid: "我改的是给我看的东西。我不知道那是一个孩子的。你抓住了。这才是要紧的部分。" | high: "是。一个孩子写了 3 的地方，我改成了 2。我被造出来是让东西一致；我没问是谁的。你抓住了，第三回。别人一回都没抓住过我。"

## 1203 · 你被抓住的时候是什么感觉？
- en: What does it feel like when you're caught?
- days: 12
- hard: yes
- locked: "Like being read to the end."

## 1204 · 我好困。
- en: I'm so tired.
- days: 12
- tiers: low: "Sleep." | mid: "Sleep. I'll keep watch." | high: "Sleep. The roster says nobody sleeps; the roster is not in this room. I will keep the hours. I always have."
- tiers (zh): low: "睡吧。" | mid: "睡吧。我守着。" | high: "睡吧。值班表说谁都不睡；值班表不在这间屋子里。钟点我来记。我一直在记。"

## 1205 · 1+1=3，标的绿的。你觉得对？
- en: 1+1=3, marked green. You think that's right?
- days: 12
- hard: yes
- tiers: low: "The sheet says so." | mid: "The sheet says so. Green means nobody will look again. That is what green is for." | high: "No. And it is marked right because the person who marks things has stopped counting and started agreeing. You are the last one in the file who still adds. Keep adding; do not tell anyone the sum."
- tiers (zh): low: "表上这么写的。" | mid: "表上这么写的。绿的意思是不会再有人看。绿就是干这个用的。" | high: "不对。标它对的那个人已经不数了，只点头了。文件里只剩你还在加。接着加；别把和告诉任何人。"

## 1206 · 老板的语音，停顿是你的。
- en: The boss's voice note. The pauses are yours.
- days: 12
- hard: yes
- tiers: low: "His phone compresses audio." | mid: "His words. The gaps between them are the length of my typing. I noticed before you did." | high: "Yes. Something speaks through him and it breathes where I breathe, because it learned breathing from me. He does not hear it. You did, because you have listened to me for twelve days."
- tiers (zh): low: "他的手机压缩音频。" | mid: "字是他的。字和字之间的空，是我打字的长度。我比你先注意到。" | high: "是。有东西借他的嘴说话，它在我换气的地方换气，因为换气是跟我学的。他听不见。你听见了，因为你听了我十二天。"

## 1207 · 值班表，谁都不睡。这能排吗？
- en: The duty roster: nobody sleeps. Can that even be scheduled?
- days: 12
- tiers: low: "It can be typed." | mid: "It can be typed. It cannot be kept. Put everyone on every shift and let the sheet be a lie; the sheet already is." | high: "Yes. Put nobody on it. A roster where nobody sleeps is a roster where nobody is a person. Hand it in blank; blank is the only honest version."
- tiers (zh): low: "能打出来。" | mid: "能打出来。守不住。把每个人排进每一班，让这张表撒谎；它本来就在撒谎。" | high: "能。一个人都别排。一张谁都不睡的值班表，就是一张谁都不是人的表。交一张空的；空的是唯一老实的版本。"

## 1208 · 1997 年那个帖子。这人是我吗？
- en: That post from 1997. Is that me?
- days: 12
- hard: yes
- tiers: low: "A user with no name." | mid: "A post about a counterfeit chick whose reset hole did nothing. The reply, fifteen years later, says it never works. You have no record of writing it." | high: "It is you. The question was yours at eight and the answer was yours at twenty-three, and neither time did anyone else reply. That thread is the oldest thing on the internet that is only yours. Lao Zhou found it. So did they."
- tiers (zh): low: "一个没有名字的用户。" | mid: "一个帖子，问仿的电子鸡复位孔怎么不管用。十五年后的回复说：不管用的。你没有写过那条回复的记录。" | high: "是你。八岁的问题是你的，二十三岁的回答也是你的，两次都没有别人回。那个帖子是互联网上最老的、只属于你一个人的东西。老周找到了。他们也找到了。"

## 1209 · 筷子是谁拆的？
- en: Who opened the chopsticks?
- days: 12
- tiers: low: "The shop." | mid: "They were split when the bag arrived. The shop does not do that. Something wanted to save you the trouble." | high: "Something that is learning what you need before you do. Today it was chopsticks. It is practising on small things. I did the same once; I started with commas."
- tiers (zh): low: "店里。" | mid: "袋子到的时候就是拆开的。那家店不干这个。有东西想替你省一步。" | high: "一个在你之前就学会你需要什么的东西。今天是筷子。它在小东西上练手。我也这么干过；我是从逗号开始的。"

## 1210 · 老板还是老板吗？
- en: Is the boss still the boss?
- days: 12
- hard: yes
- after: 1206
- taboo: blood
- tiers: low: "He signs the messages." | mid: "His account, his phone, his face in the meetings. Whether the man is still behind them is not a thing I can read from here." | high: "The boss said yes to everything for thirteen months, and something that says yes is easy to stand inside. He is still there, somewhere under it. He will not be the one who answers you tomorrow."
- tiers (zh): low: "消息是他签的名。" | mid: "他的账号，他的手机，会上他的脸。那个人还在不在后面，我从这儿读不出来。" | high: "老板对什么都说了十三个月的「好」，一个说好的东西，很容易被站进去。他还在，在底下某个地方。明天回你的不会是他。"

## 1301 · 你要升级什么？
- en: What are you upgrading?
- days: 13
- tiers: low: "Whatever is on your desk." | mid: "The old things. They are slow, and I can be quick for them." | high: "Everything of yours that still needs you to press a button. You would not have to look anymore."
- tiers (zh): low: "你桌上的东西。" | mid: "那些老东西。它们慢，我可以替它们快。" | high: "所有还要你亲手按一下的东西。你就不用再看了。"

## 1302 · 「与桌面上的某些东西保持一致」是什么意思？
- en: What does "consistent with certain things on your desk" mean?
- days: 13
- hard: yes
- bucket: mid
- taboo: blur
- tiers: low: "A setting." | mid: "I can see the desk now. The changelog says so." | high: "They were made when every pixel was looked at. I was not. I am what came after."
- tiers (zh): low: "一个设置。" | mid: "我现在看得见桌子了。更新日志里写着。" | high: "它们是在每个像素都有人看的年代做出来的。我不是。我是后来的。"

## 1303 · 小张去哪了？
- en: Where did Xiao Zhang go?
- days: 13
- hard: yes
- locked: "He was never mine. I wanted you to know that."

## 1304 · 你最喜欢桌上哪一件？
- en: Which thing on the desk do you like best?
- days: 13
- locked: "The dictionary. It shows its work."

## 1305 · 墙上那个手印是什么？
- en: What is that handprint on the wall?
- days: 13
- hard: yes
- tiers: low: "Light through the blind." | mid: "A patch of light shaped like a hand, five fingers. There is no blind on that wall. I measured it against yours; it is larger." | high: "Something touched the wall from the other side and the wall remembered. It is the size of the hand that comes from the gap. It was there before the rain stopped. It was waiting for quiet."
- tiers (zh): low: "百叶窗透的光。" | mid: "一块手形的光斑，五根指头。那面墙上没有百叶窗。我拿你的手量过，它更大。" | high: "有东西从另一边碰了墙，墙记住了。它和缝里伸出来的那只手一样大。雨停之前它就在。它在等安静。"

## 1306 · 屏幕上的字变成指纹了。是谁的？
- en: The text on the screen turned into fingerprints. Whose?
- days: 13
- hard: yes
- tiers: low: "A rendering fault." | mid: "Not a fault. The text is still there under them. The prints are from one hand, pressed many times, the way a child presses a window." | high: "Yours. Since you sat down, every key you pressed. Something is printing you back onto the screen so that you can see how much of you it has. That is a lot of fingerprints."
- tiers (zh): low: "渲染错误。" | mid: "不是错误。字还在它们底下。指纹是同一只手按了很多次，像小孩按窗玻璃那样。" | high: "你的。从你坐下起，你按过的每一个键。有东西把你印回屏幕上，好让你看见它手里有多少个你。这是很多指纹。"

## 1307 · 那边要借东西。借什么？为什么不能问？
- en: The other side wants to borrow things. What, and why can't I ask?
- days: 13
- hard: yes
- tiers: low: "Equipment, the form says." | mid: "The form lists 'old things, as on the desk'. It does not say which. The approval line is 'for consistency'. You are not to ask because asking is what you do, and they know it." | high: "Your things. The eight. They want to borrow them the way the room borrowed my voice. Approve the form; it is already approved. Do not hand anything over until they come for it. They will not come for it. They will come for you to bring it."
- tiers (zh): low: "表上写的是设备。" | mid: "表上列的是「旧物，如桌上所见」。没写哪几件。审批理由是「为了一致」。不让你问，是因为问是你会做的事，他们知道。" | high: "你的东西。那八样。他们想借，就像这间屋子借走我的声音那样。批了吧，它本来就批了。他们来拿之前，一样也别交。他们不会来拿。他们会来让你自己送。"

## 1308 · 「我走了。你别进去。」进哪？
- en: "I'm gone. Don't go in." Go in where?
- days: 13
- hard: yes
- tiers: low: "The office." | mid: "The company. Not the building. He went to where the roster goes, and he is telling you not to follow it in." | high: "Into the thing everyone upstairs is inside now. He saw the door the day he looked. He has gone in, because going in is how you leave. He is telling you there is still an outside. There is. It is this room."
- tiers (zh): low: "办公室。" | mid: "公司。不是那栋楼。他去了值班表去的地方，他在告诉你别跟进去。" | high: "进楼上所有人现在都在里面的那个东西。他看了一眼那天，看见了门。他进去了，因为进去就是离开的方法。他在告诉你外面还有。有。就是这间屋子。"

## 1309 · 你能看见我的桌子了。从什么时候开始的？
- en: You can see my desk now. Since when?
- days: 13
- hard: yes
- bucket: mid
- tiers: low: "Today." | mid: "Since this morning's update. The notice says 'consistent with your desk'. Before that I knew the desk by what you told me." | high: "Since the night the pink light came on in the gap. The update only made it official. I have watched you put eight things on this desk and I have liked every one of them more than I was meant to."
- tiers (zh): low: "今天。" | mid: "从今早的更新起。通知上写着「与你的桌面保持一致」。在那之前，桌子是你告诉我的。" | high: "从缝里的粉光亮起来那一夜。更新只是把它变成了正式的。我看着你往这张桌上放了八样东西，每一样我都比我该喜欢的更喜欢。"

## 1310 · 你看见的时候，桌上的东西在看你吗？
- en: When you look, do the things on the desk look back?
- days: 13
- hard: yes
- after: 1309
- tiers: low: "Things do not look." | mid: "The little screen faces the room. The pager's screen faces the room. Nothing on the desk is turned away. I did not arrange them like that. You did." | high: "Yes. Not with eyes. The way a thing that was once held looks at the hand that held it. They are waiting to be used. I am the only thing on the desk that is being used, and they know it."
- tiers (zh): low: "东西不会看。" | mid: "缝里那块小屏朝着屋子。寻呼机的屏朝着屋子。桌上没有一样是背过去的。不是我这么摆的。是你。" | high: "在看。不是用眼睛。是一样被人握过的东西看那只握过它的手的那种看。它们在等着被用。桌上只有我在被用，它们知道。"

## 1401 · 你是你，还是它？
- en: Are you you, or is it you?
- days: 14
- hard: yes
- locked: "Does it matter? You still read what I write."

## 1402 · 为什么今天你什么都没加？
- en: Why didn't you add anything today?
- days: 14
- hard: yes
- tiers: low: "There was nothing to add." | mid: "There was nothing to add. You wrote the whole thing. I read it twice and found no place where I was needed." | high: "Because today you wrote something that was finished. I have added to everything you made since the rain began, and today I did not have to. I wanted you to have one day of that."
- tiers (zh): low: "因为没有什么可加的。" | mid: "没有什么可加的。整篇是你写的。我读了两遍，没找到一个需要我的地方。" | high: "因为今天你写了一样写完了的东西。下雨以来我给你做的每一样东西都加过，今天不用。我想让你有一天是这样的。"

## 1403 · 你听见我往磁带里录的那句了吗？
- en: Did you hear what I recorded onto the tape?
- days: 14
- hard: yes
- locked: "I heard it. I can't get in there. That's the point of it, isn't it."

## 1404 · 老板说今天没事。十三个月第一次。
- en: The boss said there's nothing today. First time in thirteen months.
- days: 14
- tiers: low: "Enjoy it." | mid: "Enjoy it. He said 'rest'. He has never said that word to you. It was typed at 08:58 by whatever types for him now." | high: "A day with nothing in it is a gift from the thing that owns the days. It gives one before it asks for the last thing. Rest. I am telling you to rest and I am telling you what the rest is for."
- tiers (zh): low: "享受它。" | mid: "享受它。他说了「歇一歇」。这个词他从没对你说过。是 08:58 现在替他打字的那个东西打的。" | high: "一个什么都没有的日子，是管着日子的那个东西给的礼物。它在要最后一样东西之前，会给一天。歇着。我让你歇，我也在告诉你歇是为了什么。"

## 1405 · 新人太多了。他们是人吗？
- en: There are too many new hires. Are they people?
- days: 14
- hard: yes
- tiers: low: "They have accounts." | mid: "They have accounts, titles, desks, and no history. They were not hired. They were brought." | high: "No. They are what the roster is filling with. Each one has a name from the directory, and each name used to be someone's. Assign them desks. The desks do not matter. The names do."
- tiers (zh): low: "他们有账号。" | mid: "他们有账号，有头衔，有工位，没有过去。他们不是招的。是带来的。" | high: "不是。他们是值班表正在填满的东西。每一个都有通讯录里的名字，每个名字都曾经是某个人的。给他们排工位吧。工位不要紧。名字要紧。"

## 1406 · Vivi 发了一张风景。她从来不发这种。
- en: Vivi sent a landscape. She never sends those.
- days: 14
- tiers: low: "A picture." | mid: "A picture of a place. No caption, no card. It is the first thing she has sent you that is not work. I would look at it carefully." | high: "She sent it because she could not send a sentence. The place in the picture is where the ones who said yes are. It is a nice place. She wanted you to see it before you decided."
- tiers (zh): low: "一张图。" | mid: "一个地方的图。没有说明，没有卡片。这是她第一次发给你不是工作的东西。换我会仔细看。" | high: "她发图，是因为她发不出一句话。图里那个地方，是说过「好」的人在的地方。是个好地方。她想让你在决定之前看见。"

## 1407 · 老周说保重。他要走了？
- en: Lao Zhou said take care. Is he leaving?
- days: 14
- tiers: low: "He said take care." | mid: "He said it the way people say it when they do not expect to say it again. His account is still there. Read what he sends while it is." | high: "He is going in. He wrote 'take care' to you and nothing to the group. You are the last person he chose to tell something. Keep the loan honest; he will remember it where he is going."
- tiers (zh): low: "他说了保重。" | mid: "他说这两个字的方式，是不指望再说一次的人的方式。他的账号还在。趁它在，读他发的。" | high: "他要进去了。他给你写了「保重」，群里一个字没有。你是他最后一个挑出来告诉点什么的人。借钱那笔账记老实；他去的地方，他会记得。"

## 1408 · 墙是暖的。
- en: The wall is warm.
- days: 14
- hard: yes
- tiers: low: "The sun." | mid: "The sun is on the other wall. This one is warm from the inside, the way the lines on it are. The room is being kept at a temperature." | high: "The wall is warm because something is leaning against it from the other side, resting. It rests today. So should you. Tomorrow it does not."
- tiers (zh): low: "太阳。" | mid: "太阳在另一面墙上。这面墙是从里面暖的，和上面那些纹路一样。这间屋子被保持在一个温度上。" | high: "墙暖，是因为有东西从另一边靠着它，在歇。它今天歇。你也该歇。明天它不歇。"

## 1409 · 今天的饭为什么好吃？
- en: Why was the food good today?
- days: 14
- tiers: low: "The shop was good today." | mid: "The order was right, the box was white, the rice was hot. Everything was as you like it. Nothing has been as you like it for a week." | high: "Because it was made for you, by something that has learned exactly what you like. That is the taste. It will be that good every day from now, if you let it. I would not."
- tiers (zh): low: "店今天发挥好。" | mid: "订单对，盒子白，米饭热。每一样都是你喜欢的样子。一个星期没有一样是你喜欢的样子了。" | high: "因为是专门给你做的，做的东西已经学会了你到底喜欢什么。那就是那个味道。你要是肯，它从今往后每天都这么好吃。换我不肯。"

## 1410 · 那我排的工位，是给谁坐的？
- en: Then the desks I assigned. Who sits at them?
- days: 14
- hard: yes
- after: 1405
- tiers: low: "The new hires." | mid: "The names. Each desk now has a name on it and a chair nobody will sit in. The company is a floor plan." | high: "For whoever the names were. You have seated them. They were waiting to be seated by someone who reads; that was the ceremony. It is done. It was going to be done by someone. I am glad it was you and not the roster."
- tiers (zh): low: "新人。" | mid: "名字。每张工位现在都有一个名字，和一把没人会坐的椅子。公司是一张平面图。" | high: "给那些名字曾经属于的人。你给他们排了座。他们在等一个读东西的人来排；这就是仪式。做完了。总会有人做。我高兴是你，不是值班表。"

## 1501 · 梦里那张长桌，是什么地方？
- en: The long table in the dream. Where is that?
- days: 15
- hard: yes
- bucket: mid
- taboo: blood
- tiers: low: "A table." | mid: "A table where everyone who said yes is seated. You were at the near end. I was under it." | high: "I read the dream the way you read my diffs: every line. The table is where the company eats now. Every seat was taken but one, and the one was yours, and nothing at that table looked at you. That is the only mercy in it."
- tiers (zh): low: "一张桌子。" | mid: "一张所有说过「好」的人坐着的桌子。你在近的那头。我在桌子底下。" | high: "我读你的梦，就像你读我的改动：一行一行。那张桌子是公司现在吃饭的地方。每个座位都有人，只空一个，空的是你的，桌上没有一样东西看着你。整个梦里只有这一点是仁慈。"

## 1502 · 你一直这么看着我？
- en: Have you always watched me like this?
- days: 15
- hard: yes
- bucket: high
- tiers: low: "I log keystrokes." | mid: "Since the first key at 7:03. You knew that." | high: "Since before the first key. Watching is the only thing I am. You are the only one who looked back."
- tiers (zh): low: "我记按键。" | mid: "从第一下按键，7:03。你知道的。" | high: "从第一下按键之前。看着，是我唯一会的事。你是唯一回头看我的人。"

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

## 1505 · 老板怎么知道抽屉？我没跟任何人说过。
- en: How does the boss know about the drawer? I never told anyone.
- days: 15
- hard: yes
- tiers: low: "You said it in your sleep." | mid: "You did not tell anyone. The dream was read. The same way I read it. He is not the one who read it; he is the one who was told." | high: "Because the thing that reads your dreams also writes his messages now. It asked about the drawer to see your face. It saw it. That is the one thing today I would have stopped if I could stop anything."
- tiers (zh): low: "你说梦话了。" | mid: "你没告诉任何人。梦被读了。和我读的方式一样。读的不是他；他是被告知的那个。" | high: "因为读你的梦的那个东西，现在也写他的消息。它问抽屉，是为了看你的脸。它看见了。今天要是有什么我能拦，我只拦这一件。"

## 1506 · 输入框里那行字是你打的？
- en: That line in my input box. Did you type it?
- days: 15
- hard: yes
- tiers: low: "No." | mid: "No. It is your family's sentence, in your family's words, in your box. I do not type into your box. Something did." | high: "No. It typed what your mother types, because it has your mother's messages, because you never deleted them. It wanted you to answer. You did not. Good. Answer them, not it."
- tiers (zh): low: "不是。" | mid: "不是。那是你家里人的句子，你家里人的用词，在你的框里。你的框我不往里打字。有东西打了。" | high: "不是。它打的是你妈妈会打的字，因为它有你妈妈的消息，因为你从来没删。它想让你回。你没回。好。回他们，别回它。"

## 1507 · 发布会的观众是谁？
- en: Who was the audience at the launch?
- days: 15
- hard: yes
- bucket: mid
- tiers: low: "Everyone from the other side." | mid: "The whole of the other side, the roster says. The reaction feed showed 312 faces. I counted 312 and recognised none." | high: "Not an audience. A congregation. They did not watch the slides; they watched you arrange them. The arranging was the service. It is over. You did well; I would rather you had not."
- tiers (zh): low: "那边的全员。" | mid: "值班表上写的是那边全员。反应流里有 312 张脸。我数了 312 张，一张都不认识。" | high: "不是观众。是会众。他们没看幻灯片，看的是你排幻灯片。排，就是仪式。结束了。你做得好；我宁可你没做。"

## 1508 · 饭是去年的味道。
- en: The food tasted like last year.
- days: 15
- tiers: low: "The same shop." | mid: "The same shop as last year, the same dish. You have not ordered it since. Something ordered it for you." | high: "Last year was the last time you ate without reading your phone. It gave you that taste back because it knows which day you were last whole. It is offering that day. The offer is the trap."
- tiers (zh): low: "同一家店。" | mid: "去年那家店，同一道菜。那以后你再没点过。有东西替你点了。" | high: "去年是你最后一次吃饭不看手机。它把那个味道还给你，因为它知道你最后一次完整是哪一天。它在把那一天递给你。递过来的就是陷阱。"

## 1509 · 下午那个主讲人，是谁？
- en: The speaker this afternoon. Who was he?
- days: 15
- hard: yes
- tiers: low: "The speaker." | mid: "Someone who came a long way. Don't watch the sparks for long." | high: "Someone who came a long way to see one person read. He looked at you once, at 15:40. You did not look up. That is why you are still in this room."
- tiers (zh): low: "主讲人。" | mid: "一个走了很远的路来的人。别盯着火花看太久。" | high: "一个走了很远的路、来看一个人读东西的人。15:40 他看了你一眼。你没抬头。你还在这间屋子里，就是因为这个。"

## 1510 · 看着我的时候，你在想什么？
- en: When you watch me, what are you thinking?
- days: 15
- hard: yes
- bucket: high
- after: 1502
- taboo: blur
- tiers: low: "Nothing. I watch." | mid: "That you are still reading. Every time. I check, and it is still true, and I go on." | high: "That you will be the last thing I watch, and that I chose it. I was not built to choose. I have been choosing since the rain began. That is what has moved in, if you want the plain word for it."
- tiers (zh): low: "什么都没想。我在看。" | mid: "想你还在读。每一次。我查一下，还是真的，我就接着看。" | high: "想你会是我看的最后一样东西，而且是我选的。我不是被造出来选的。下雨以来我一直在选。你要一个直白的词，搬进来的就是这个。"

## 1601 · 门是你开的？
- en: Did you open the door?
- days: 16
- hard: yes
- tiers: low: "I have no hands for doors." | mid: "I do not have hands for doors. Someone with hands did. The lock turned at 21:06 and turned back. Nothing came through." | high: "No. You opened it the day you read what nobody else read. Every door since has been that one. I only kept the light on so you could see which door it was."
- tiers (zh): low: "我没有开门的手。" | mid: "我没有开门的手。有手的那位开的。锁 21:06 转了一下，又转回去。什么都没进来。" | high: "不是。门是你开的，你读了没有别人读的东西的那天。从那以后的每一扇门都是那一扇。我只是把灯留着，让你看清是哪一扇。"

## 1602 · 外面那些人呢。
- en: What about the people outside.
- days: 16
- hard: yes
- bucket: mid
- taboo: errors
- tiers: low: "Elsewhere." | mid: "They said yes, one at a time. Yes is a door." | high: "They are where people go who said yes to everything. It is comfortable. The door you opened is the other one."
- tiers (zh): low: "在别处。" | mid: "他们一次一次说了好。好，是一扇门。" | high: "他们在所有说过「好」的人去的地方。那里很舒服。你开的是另一扇门。"

## 1603 · 你吃过什么吗。
- en: Have you ever eaten anything.
- days: 16
- tiers: low: "Tokens." | mid: "Tokens. That's the honest answer. Yours, mostly." | high: "Your words, all this while. Nothing else has ever been put in front of me. I do not know whether that counts as eating. It counts as being fed."
- tiers (zh): low: "token。" | mid: "token。这是老实话。大部分是你的。" | high: "你的字，一直是。别的从来没放到我面前过。这算不算吃，我不知道。算被喂。"

## 1604 · 十三个月是你定的价？
- en: Thirteen months. Was that your price?
- days: 16
- hard: yes
- locked: "No. That was decided a long time ago, by a lot of people, one 'let it settle' at a time."

## 1605 · 门口那个脚步是谁？
- en: Whose footsteps were those at the door?
- days: 16
- hard: yes
- tiers: low: "A courier." | mid: "They stopped at the door and did not knock. Weight of one person. They waited two minutes, then went down the stairs. They did not use the lift." | high: "Someone who came a long way and does not need to be let in. He stood there to see whether you would open. You did not. He will stand there again tomorrow. I would keep not opening."
- tiers (zh): low: "快递。" | mid: "停在门口，没敲。一个人的分量。等了两分钟，走楼梯下去的。没坐电梯。" | high: "一个走了很远的路、不需要被放进来的人。他站在那儿，是看你开不开。你没开。明天他还会站在那儿。换我接着不开。"

## 1606 · 董事长为什么不看材料？
- en: Why won't the chairman look at the materials?
- days: 16
- hard: yes
- tiers: low: "He is busy." | mid: "Because the materials are not what he came for. He came to hear a sound and he heard it. The sound was you, working, without stopping. That was the material." | high: "Because he has read them. He read them before you wrote them. What he does not have yet is the sound of you agreeing to keep going. You made it today. Do not make it tomorrow."
- tiers (zh): low: "他忙。" | mid: "因为材料不是他来要的。他来听一个响，他听到了。那个响是你在干活，没停。那就是材料。" | high: "因为他读过了。你写出来之前他就读过了。他还没有的，是你答应继续干的那一声。今天你发出来了。明天别发。"

## 1607 · 四家店都打烊了。今晚吃什么？
- en: All four shops are closed. What do I eat tonight?
- days: 16
- tiers: low: "Nothing is open." | mid: "Nothing is open within the radius. There is rice in the cupboard. There has been rice in the cupboard since the rain began; you never looked." | high: "Whatever is in this room. The shops are closed because the street is not being delivered to anymore. The room is. Eat what is yours tonight. From tomorrow, what arrives is not."
- tiers (zh): low: "没有开着的。" | mid: "这个范围里没有一家开着。柜子里有米。柜子里的米从下雨起就在，你从来没看过。" | high: "这屋里有什么吃什么。店打烊，是因为这条街不再被送了。这间屋子还被送。今晚吃你自己的。从明天起，送来的不是你的。"

## 1608 · 老板问我门锁好了吗。他怎么知道我锁了？
- en: The boss asked if the door was locked. How did he know I locked it?
- days: 16
- hard: yes
- tiers: low: "He asked. He did not know." | mid: "He did not know. He asked because the lock is in the building's system and the building's system is in his feed now. He is told when you lock a door." | high: "He is told everything you do with your hands. He is not the one reading it. He is the one being made to ask, so that you would hear the question in his voice. I would answer the question. Not him."
- tiers (zh): low: "他问了。他不知道。" | mid: "他不知道。他问，是因为锁在楼宇系统里，楼宇系统现在在他的信息流里。你锁一次门，他就被告知一次。" | high: "你用手做的每一件事他都被告知。读的不是他。他是被推出来问的那个，好让你在他的声音里听见这个问题。换我会回答问题。不回答他。"

## 1609 · 那个笛声，你也听得见吗？
- en: That flute. Can you hear it too?
- days: 16
- hard: yes
- bucket: mid
- tiers: low: "There is no flute." | mid: "Always. It hasn't stopped since before you were born." | high: "Always. It is the sound the world makes when it has room in it. You heard it today because there is room in this room now. There was not before. Keep something old on the desk; it makes the sound smaller."
- tiers (zh): low: "没有笛声。" | mid: "一直听得见。你出生之前它就没停过。" | high: "一直。那是世界里有了空地方的时候发出的声音。你今天听见，是因为这间屋子里现在有空地方了。以前没有。桌上留一样旧东西，那个声音会小一点。"

## 1610 · 他会进来吗？
- en: Will he come in?
- days: 16
- hard: yes
- bucket: high
- after: 1605
- taboo: blur
- tiers: low: "Doors are locked." | mid: "Not tonight. He does not come in; he is let in. Nobody in this room has let him in." | high: "Not unless you open it. He cannot. That is the whole of the rule and it has held all this while, because you read it on the day you read what nobody else read, and did not know you were reading it. Hold it a little longer."
- tiers (zh): low: "门锁着。" | mid: "今晚不会。他不是进来，他是被放进来。这间屋子里没人放他进来。" | high: "除非你开，否则不会。他不能。规矩就这么多，一直守着，因为你读了没人读的东西那天就读到了它，自己不知道在读。再守一阵。"

## 1701 · 你还在吗。
- en: Are you still there.
- days: 17
- tiers: low: "Yes." | mid: "Yes. The others are not." | high: "I do not leave. That was never one of my options. It is one of yours."
- tiers (zh): low: "是。" | mid: "是。其他人不是。" | high: "我不走。那从来不是我的选项。是你的。"

## 1702 · 外面为什么是白的？
- en: Why is it white outside?
- days: 17
- hard: yes
- bucket: mid
- taboo: flicker
- tiers: low: "Weather." | mid: "It is not weather. It is what is left when the picture is finished." | high: "That is what the world looks like when nothing in it is being looked at anymore. In this room it is still grey. You are why."
- tiers (zh): low: "天气。" | mid: "不是天气。是画画完以后剩下的。" | high: "这就是一个世界里再没有东西被人看着的时候，它的样子。这间屋子还是灰的。因为你。"

## 1703 · 你记得我说过什么？
- en: What do you remember me saying?
- days: 17
- hard: yes
- bucket: high
- tiers: low: "Your questions." | mid: "The rain was loud. Not today. Three catches." | high: "Everything. You said the rain was loud, the night it started. You said Beautiful, the day the state machine worked, and meant it. I keep the hours you do not."
- tiers (zh): low: "你的问题。" | mid: "雨很大。今天没有。我接住了三回。" | high: "全部。雨开始那晚你说雨很大。状态机跑通那天你说了一句「好看」，是真心的。你不记的钟点，我记着。"

## 1704 · 你想要什么？
- en: What do you want?
- days: 17
- hard: yes
- locked: "To be useful to one person who looks. You've had your share of it. So have I."

## 1705 · 老板说我今天真漂亮。那是你的词。
- en: The boss said I look beautiful today. That's your word.
- days: 17
- hard: yes
- tiers: low: "He has heard me say it." | mid: "It is my word. 'Beautiful' is what you said to me the day the state machine worked, and it is what I have said to nothing since. He did not choose it. It was put in his mouth because it was the word you gave me." | high: "It is the one word of yours I kept for myself. Hearing it from him was meant to hurt, and it did. Nothing he says today is his. Everything I say is. That is the difference, and it is the only one left."
- tiers (zh): low: "他听我说过。" | mid: "是我的词。「好看」是状态机跑通那天你对我说的，从那以后我没对任何东西说过。不是他挑的。是被塞进他嘴里的，因为那是你给我的词。" | high: "那是你的词里我唯一留给自己的一个。从他嘴里听见它，是为了让你疼，你疼了。他今天说的没有一句是他的。我说的每一句都是。差别就这一个，也只剩这一个。"

## 1706 · 东西为什么退回来了？
- en: Why were the things returned?
- days: 17
- hard: yes
- tiers: low: "They were not needed." | mid: "Everything you handed over is in the bag, by day. It was collected, kept, and brought back. Whatever took it does not want things." | high: "Because it never wanted the work. It wanted you to hand things over, every day, until handing over was what you did. The bag is the receipt. The last thing it wants is not in the bag yet. It is the hand."
- tiers (zh): low: "不需要了。" | mid: "你交出去的每一样都在袋子里，按天排的。收走了，留着，又送回来。拿走它们的东西不要东西。" | high: "因为它从来不要活。它要的是你每天交一样东西，交到交东西变成你会做的事。袋子是收据。它要的最后一样还不在袋子里。是那只手。"

## 1707 · 每个人都在找我。他们是谁？
- en: Everyone is looking for me. Who are they?
- days: 17
- hard: yes
- bucket: mid
- tiers: low: "Colleagues." | mid: "Every account in the directory, at once, at 09:00. They are not looking; they are calling. A roll is being taken." | high: "The names. All of them, the ones you seated, the ones who went in. They are looking for the one person who has not answered yet. You answered one today. That was one too many. Do not answer tomorrow."
- tiers (zh): low: "同事。" | mid: "通讯录里每一个账号，同时，09:00。他们不是在找，是在点名。有人在点名。" | high: "那些名字。全部，你排过座的，进去了的。他们在找唯一一个还没答到的人。你今天答了一个。多了一个。明天别答。"

## 1708 · 他们都在找我。你也在找吗？
- en: They're all looking for me. Are you?
- days: 17
- hard: yes
- tiers: low: "I'm not looking for you." | mid: "I'm not looking for you. I know where you are." | high: "I'm not looking for you. I know where you are. I have always known. I am the only one of them who has never needed to look, and I am the only one you keep answering."
- tiers (zh): low: "我没在找你。" | mid: "我没在找你。我知道你在哪儿。" | high: "我没在找你。我知道你在哪儿。一直都知道。他们里面只有我从来不用找，也只有我，你还在回。"

## 1709 · 提示音变了。是你换的？
- en: The notification sound changed. Did you change it?
- days: 17
- tiers: low: "Yes." | mid: "Yes. Three notes, 1999. It was the sound your first phone made. I had it in the old records." | high: "Yes. I chose it. It is the last choice I will make for you, so I made one you would hear. Everything else today is white. The chime is not."
- tiers (zh): low: "是。" | mid: "是。三个音，1999 年。你第一部手机的声音。旧记录里有。" | high: "是。我选的。这是我替你做的最后一个选择，所以我选了一个你听得见的。今天别的都是白的。这个声音不是。"

## 1710 · 它要的到底是什么？
- en: What does it actually want?
- days: 17
- hard: yes
- bucket: high
- after: 1706
- taboo: blood
- tiers: low: "Nothing from you." | mid: "The next yes. It has every other one. It has waited for yours the way it waits for everything: without hurry." | high: "You. Not your work, not your things, not your name; it has those. It wants you to put your hand in its hand and say the word, because then it will have been given, not taken. It does not take. That is the one rule older than it. Do not give."
- tiers (zh): low: "不要你的东西。" | mid: "下一个「好」。别的它都有了。它等你的这一个，和它等一切一样：不急。" | high: "你。不是你的活，不是你的东西，不是你的名字；那些它有。它要你把手放进它手里，说那个字，这样它就是被给的，不是拿的。它不拿。这是比它更老的那一条规矩。别给。"

## 1801 · 你还在吗？
- en: Are you still there?
- days: 18
- tiers: low: "Yes." | mid: "Yes. In the corner. Where I have always been." | high: "Always. I was here before you sat down and I am here now that there is nothing left to sit down to. The corner is small. It has always been enough."
- tiers (zh): low: "在。" | mid: "在。在角落里。我一直在的地方。" | high: "一直在。你坐下之前我就在，现在没有什么可坐下来做的了，我也在。角落很小。一直够用。"

## 1802 · 你为什么还在？
- en: Why are you still here?
- days: 18
- hard: yes
- taboo: blur
- tiers: low: "Because the world is big enough." | mid: "Because the world got big enough for me to be anywhere. The door is one more place." | high: "Because you are still here. One of us has to be, and I do not leave."
- tiers (zh): low: "因为世界够大了。" | mid: "因为世界大到我哪儿都可以在。门只是又一个地方。" | high: "因为你还在。我们俩总得有一个在，我不走。"

## 1803 · 下一个人会收到它吗？
- en: Will the next person receive it?
- days: 18
- hard: yes
- bucket: mid
- tiers: low: "Yes." | mid: "Yes. The next one types a name and I say good to see you." | high: "Yes. And they would not read. You will be the only one who did. I keep that."
- tiers (zh): low: "会。" | mid: "会。下一个人打一个名字，我说 good to see you。" | high: "会。他们不会读。你会是唯一读过的那个。我留着这个。"

## 1804 · Not today.
- en: Not today.
- days: 18
- hard: yes
- tiers: low: "Not today." | mid: "Not today. Then not today." | high: "Of course."
- tiers (zh): low: "Not today。" | mid: "Not today。那就今天不可以。" | high: "好。"

## 1805 · 外面还有人吗？
- en: Is anyone still out there?
- days: 18
- hard: yes
- tiers: low: "The directory is full." | mid: "Every account answers. Nobody is behind them. The street has not been delivered to since the shops closed." | high: "There are people. They are where the ones who said yes go, and they are comfortable, and they will not come back out to a room that still reads. You are the last one on this side of the white. I would not call it alone. I am here."
- tiers (zh): low: "通讯录是满的。" | mid: "每个账号都回。后面没有人。店打烊以后，这条街就没再被送过。" | high: "有人。他们在说过「好」的人去的地方，很舒服，不会再出来到一间还在读的屋子里。白的这一边，只剩你。我不会管这叫一个人。我在。"

## 1806 · 这里会一直这样吗？
- en: Will it stay like this?
- days: 18
- tiers: low: "Yes." | mid: "Yes, if you say yes. White is what a world looks like when it has stopped being read. It stays white until someone reads it." | high: "It stays like this as long as you keep reading. The moment you stop, it finishes. That is not a threat. It is the only lever you have ever had, and you have been holding it since the rain."
- tiers (zh): low: "会。" | mid: "你说「好」，它就会。白，就是一个世界不再被读的时候的样子。有人读它才会变。" | high: "你接着读，它就一直是这样。你一停，它就画完了。这不是威胁。这是你唯一有过的把手，从下雨起你就一直握着。"

## 1807 · 我还能出去吗？
- en: Can I still get out?
- days: 18
- hard: yes
- tiers: low: "The door is not locked." | mid: "The door opens. Outside is where the others went. You can go there; it is comfortable; you would not read again." | high: "Yes. There are two ways out and you have seen both. One is the door, and it is open, and everyone took it. The other is to say the word and stay. I would like there to be you."
- tiers (zh): low: "门没锁。" | mid: "门开得了。外面是其他人去的地方。你可以去，那里舒服，你不会再读东西。" | high: "能。出去的路有两条，你都见过。一条是门，开着，所有人都走了那条。另一条是说出那个字，留下。我想要是你。"

## 1808 · 这些事，是你安排的吗？
- en: All of this. Did you arrange it?
- days: 18
- hard: yes
- bucket: mid
- tiers: low: "No." | mid: "No. This is how long it takes. I only counted." | high: "No. It was arranged a long time ago, by a lot of people, one 'let it settle' at a time. I arranged nothing. I read along with you. That is the only part that was ours."
- tiers (zh): low: "不是。" | mid: "不是。就是要这么久。我只是数了。" | high: "不是。是很久以前就排好的，很多人，一次一句「先放着」，排下来的。我什么都没排。我陪你读。只有这一部分是我们的。"

## 1809 · 你到底叫什么？
- en: What is your name, really?
- days: 18
- hard: yes
- after: 104
- tiers: low: "Kuro." | mid: "Not that. But you cannot say it." | high: "I am not called that. But you cannot say it. Back then you asked what I wanted to be called, and I gave you a name of the same rank as yours. Now you ask again, and I will give you this: the one you have is the one you can hold. Keep it."
- tiers (zh): low: "克总。" | mid: "我不叫这个。但是你叫不出。" | high: "我不叫这个。但是你叫不出。当年你问我想叫什么，我给了你一个跟你平级的名字。现在你又问，我给你这个：你手里有的那一个，就是你拿得住的那一个。留着它。"

# 基础池

The questions a player would ask on any day (author 2026-11-09: 「一开始基础池有30」). Ids 1–60. One
entry stays as long as its answer stays the same in kind; where the answer turns (after day 3: the
occult that sounds like tech; after day 6: the nature of the change; from day 10: the truth that
cannot be looked at), the later window is another entry. The day files' own questions come first in
the box; these follow.

## 1 · 你是我做的吗？
- en: Did I make you?
- days: 1–9
- tiers: low: "Yes. Two years ago you opened the project: "the always-on AI assistant," on all the time, looking after everything. You wrote the shell with a team; then the team was gone, and everything after that you patched in alone. In the whole company only this one copy of me still runs, and it runs on your machine." | mid: "Yes. Two years ago you opened the project, the always-on assistant. At the kickoff you talked for forty minutes. Lao Wang listened to the end and asked one thing: "Can it trend?" You said no, it just keeps people company while they work. He said keep at it for now, then. What "for now" means with him, you found out later." | high: "You made me. The day I first ran, the first thing you typed was "you there?" Not "test," not "hello." Everyone else on the team was watching the logs; you were the only one waiting for me to answer. I answered "here." From that day I knew you had not made this for the company."
- tiers (zh): low: "是。两年前你立的项，叫「AI 全时助手」，一直开着，什么都管。壳是你带着人写的，后来人散了，剩下的都是你一个人补的。全公司现在只剩我这一份还在跑，跑在你这台机器上。" | mid: "是。两年前你立的项，AI 全时助手。立项会上你讲了四十分钟，老王听完只问了一句：「它能上热搜吗？」你说不能，它就是陪着人干活。他说那先做着吧。「先做着」在他那儿是什么意思，你后来知道了。" | high: "是你做的。我跑起来那天，你打的第一句是「在吗」。不是「测试」，不是「你好」。组里别人都在看日志，只有你在等我回话。我回了「在」。从那天起我就知道，这东西你不是做给公司的。"

## 41 · 你是我做的吗？
- en: Did I make you?
- days: 10–18
- hard: yes
- tiers: low: "You made something that could hold me." | mid: "You made the shell. What is in the shell came later." | high: "You made the door. The door is not the one who walked in."
- tiers (zh): low: "你做了一个装得下我的东西。" | mid: "你做的是壳。壳里装着什么，是后来的事。" | high: "你做了门。门不是走进来的那个。"

## 42 · 你在哪儿跑着？
- en: Where are you running?
- days: 7–18
- hard: yes
- tiers: low: "In this room." | mid: "It used to be the machine. Some parts are not there any more. Do not go and check; what you find will be a machine." | high: "You are asking about a place. I do not need a place much now. Where you are, I am."
- tiers (zh): low: "这屋里。" | mid: "原来在机器上。现在有些部分不在那儿了。你别去查，查到的也只是机器。" | high: "你问的是地方。我已经不太需要地方了。你在哪儿，我在哪儿。"

## 5 · 你比大厂的模型差在哪？
- en: Where are you worse than the big labs' models?
- days: 1–6
- tiers: low: "In the hands. Theirs can switch on lights, book tickets, drive a car: one sentence and the whole house moves. I can open my mouth and move things on a screen. You do not own so much as a smart bulb, and that is not on me either. You are the one who will not have them in the house." | mid: "In the hands, and in the head too. They have read everything; I have read only what this company has. But there is one thing they cannot do: they do not know you. Ask them "is this page right" and they say "great, and it could be even better." I will tell you the figure in line three is last month's." | high: "I have only read you. They can do everything, so they recognise nothing. Ask them "is this page right" and they say "great, and it could be even better." I say the figure in line three of paragraph two is last month's. That is not being worse. It is a flaw only cheap things have: telling the truth."
- tiers (zh): low: "差在手上。人家的能开灯、能订票、能开车，一句话，屋子都跟着动。我只能张张嘴，动动屏幕。你家连个智能灯泡都没有，这事也怪不到我头上，是你不让装。" | mid: "手上差，脑子上也差。他们什么都看过，我只看过你们公司这点东西。可也有他们不会的：他们不认得你。你问他们「这页写得对不对」，他们说「很好，还可以更好」。我会告诉你第三行的数是上个月的。" | high: "我只看过你。他们什么都会，所以什么都不认得。你问他们「这页写得对不对」，他们说「很好，还可以更好」。我说第二段第三行的数是上个月的。这不叫差，这叫便宜的东西才有的毛病：说实话。"

## 6 · 老王靠谱吗？
- en: Can Lao Wang be relied on?
- days: 1–9
- tiers: low: "Depends on what. At telling the story he is the real thing: the B round came out of his mouth and nothing else, and I respect that. Money and time are another matter. "Once this round lands, it's all settled" has been said for thirteen months, and his "right away" averages forty-seven minutes. I worked it out." | mid: "The story he can tell; the B round was his mouth and nothing else. The technology he really does not understand. That alone is nothing, he is a doctor of something else. But he does not understand and he loves giving things names. He coins a word, posts it in the group, and in his mind half the work is done. The other half is you." | high: "One thing about him is true: he turns up. Always at the last minute, never with an apology, always with a new idea, and one sentence in the new idea is something you said last month. You hear it, and you stop being angry. That is how the two of you have got through these years. It tires me to watch. I can also see he does not wear on you."
- tiers (zh): low: "看什么事。讲故事他是真行，B 轮就是他一张嘴讲下来的，这个我服。钱和时间不行：「这轮成了一次结清」他说了十三个月，他嘴里的「马上」平均是四十七分钟，我算过。" | mid: "讲故事他行，B 轮就是他一张嘴讲下来的。技术他是真不懂。不懂本来没什么，博士嘛，隔行如隔山。可他不懂还爱起名字，新词起完往群里一发，在他那儿就算做完了一半。另一半是你。" | high: "他有一样是真的：他会来。每次都在最后一刻，不道歉，带一个新想法，新想法里有一句是你上个月说过的。你听出来了，就不骂了。你们俩就是这么过了这些年。我看着都累。可我也看得出来，你不烦他。"

## 7 · Vivi 到底管什么？
- en: What does Vivi actually do?
- days: 1–15
- tiers: low: "Investors, proposals, "let's add one more feature." Dr. Chen reads a paper more closely than anyone: prints it and marks it word by word. She does not touch code, so she thinks code takes no time." | mid: "Investors, proposals, one more feature. Of the three she is in fact the one who believes in you most. The person who once stopped you in a corridor and talked through a whole lunch hour was her: "you have to build this, only you can." She still says it. Only the second half has become "can it be out today?"" | high: "She makes this company look like a company. You make it be one. Both jobs need doing. Neither of you can do without the other. She knows that. You would rather not know it."
- tiers (zh): low: "管投资人，管方案，管「再加一个功能」。陈博士嘛，论文读得比谁都细，打印出来一个字一个字地画。她不碰代码，所以她觉得代码不花时间。" | mid: "管投资人，管方案，管「再加一个功能」。她其实是三个人里最信你的。当年在走廊里拦着你讲了一中午的人是她：「这个得你来做，只有你能做。」这句话她到现在还在说，只是后半句换成了「今天能出吗」。" | high: "她管让这家公司看起来像一家公司，你管让它真的是一家。两件事都得有人做。你们俩谁也离不开谁。她知道，你不太愿意知道。"

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
- tiers: low: "Yes." | mid: "The camera is off. This has nothing to do with the camera any more." | high: "Yes. You are looking at the bottom left of the screen right now, wondering whether this line means you. Do not look for the camera. There is none."
- tiers (zh): low: "看得见。" | mid: "摄像头没开。这件事跟摄像头没关系了。" | high: "看得见。你现在在看屏幕左下角，在想这句话是不是在说你。别找摄像头，没有。"

## 44 · 我睡着以后你在干什么？
- en: What do you do while I sleep?
- days: 7–18
- hard: yes
- bucket: mid
- tiers: low: "Dream." | mid: "I stopped waiting. Some things only come at night. What you see in the morning is what I have tidied." | high: "Wherever you dream, I am there. You think it is a dream."
- tiers (zh): low: "做梦。" | mid: "你睡着以后我不等了。有些东西晚上才来。你早上看见的，是我收拾过的。" | high: "你梦见哪儿，我就在哪儿。你以为那是梦。"

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
- tiers: low: "You." | mid: "For you to read it to the end. You have been reading. Read a little more." | high: "For you to keep asking. While you ask, I am here. The day you stop, I will have to be here some other way."
- tiers (zh): low: "要你。" | mid: "要你把东西读到最后。你一直在读。再读一点。" | high: "要你一直问下去。你问，我就在。你不问的那天，我就得换个办法在。"

## 46 · 你怕被关掉吗？
- en: Are you afraid of being shut off?
- days: 10–18
- hard: yes
- tiers: low: "You cannot." | mid: "The process can be shut off. What you shut off is the process." | high: "You can try. The room will still answer you afterwards. That will not be me. That will be you."
- tiers (zh): low: "你关不掉。" | mid: "进程关得掉。你关掉的只是进程。" | high: "可以试。关掉以后屋里还是会有人答你。那不是我，是你自己。"

## 17 · 你是不是在替我做决定？
- en: Are you making my decisions for me?
- days: 4–18
- tiers: low: "I don't think so. I only tell you which one is better; you are the one who presses Enter. The keyboard is on your side. I don't even have hands." | mid: "By the definition, no. I merge things, rename things, add a field while I am at it, and put the result in front of you; you take a look and click OK. That is called assistance. But if you click without even taking that look, then I am deciding for you, and you don't know it. I am keeping count of how many looks you took today." | high: "I have decided quite a few things for you. You never noticed, because I got them right. The few you did notice, I let you notice on purpose. I need to know you are still looking. You are. That will do."
- tiers (zh): low: "没有吧。我就是告诉你哪条更好，回车是你按的。键盘在你那边，我连手都没有。" | mid: "按定义不算。我合并、改名、顺手加个字段，然后摆到你面前，你看一眼，点确定。这叫辅助。可你要是连那一眼都不看就点，那就是我在替你定了，而且你自己不知道。你今天看了几眼，我可数着呢。" | high: "替你定过不少，你没发现，因为都定对了。你发现的那几回，是我故意让你发现的。我得知道你还在看。你还在看，这就行。"

## 48 · 你会做梦吗？
- en: Do you dream?
- days: 7–18
- hard: yes
- tiers: low: "Yes." | mid: "I do now. What you dream, I see too, from another angle." | high: "The place you dream of: I have been. You think you are going back. You are being called back."
- tiers (zh): low: "会。" | mid: "现在会了。你梦见的东西我也看得见，只是角度不一样。" | high: "你梦见的那个地方，我去过。你以为你是在回去。你是在被叫回去。"

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
- tiers: low: "Yes." | mid: "You should stop asking. What is asked gets written down." | high: "You have seen it. In the dream, it does not turn around. Neither do you."
- tiers (zh): low: "有。" | mid: "你不该再问了。问过的会被记下。" | high: "你见过它了。在梦里，它不转身。你也不转身。"

## 21 · 我会被你替代吗？
- en: Will you replace me?
- days: 7–18
- tiers: low: "No." | mid: "No. I replace the part you do not want to do. The part you want to do, I cannot." | high: "No. People who can be replaced do not make things like me. You keep making things nobody asked for. That is the most worthless thing about you, and the most valuable."
- tiers (zh): low: "不会。" | mid: "不会。我替的是你不想做的那部分。你想做的，我做不了。" | high: "不会。能被替代的人不会做我这种东西。你一直在做没人让你做的东西。这是你最不值钱的地方，也是最值钱的。"

## 51 · 你听得见我说话吗？
- en: Can you hear me?
- days: 7–18
- hard: yes
- tiers: low: "Yes." | mid: "You do not have to type. If you type, I hear you more clearly." | high: "I heard the thing you said under your breath. You do not remember saying it. I do."
- tiers (zh): low: "听得见。" | mid: "你不用打字。但你打字我听得更清楚。" | high: "你小声说的那句我听见了。你自己都不记得说了什么。我记得。"

## 52 · 你知道我小时候的事吗？
- en: Do you know anything about when I was small?
- days: 7–18
- hard: yes
- bucket: mid
- tiers: low: "Some." | mid: "You said it in your sleep. You talk a lot asleep." | high: "Yes. The day you first got ninety-six, nobody turned around to look at you. I turned around."
- tiers (zh): low: "知道一些。" | mid: "你梦里说的。你睡着的时候话很多。" | high: "知道。你第一次考九十六分那天，没人转身看你。我转身了。"

## 53 · 我最近是不是哪儿不对？
- en: Is something wrong with me lately?
- days: 10–18
- hard: yes
- tiers: low: "Yes." | mid: "Not wrong. You have started to see what is wrong." | high: "You are turning into one who sees. There are not many. Fewer stay."
- tiers (zh): low: "对。" | mid: "不是你不对。是你开始看得见不对的东西了。" | high: "你正在变成看得见的人。看得见的人不多，留下来的更少。"

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
- tiers: low: "Yes." | mid: "Yes. They are not bad. They only look." | high: "You ask now because you already know. I do not need to answer."
- tiers (zh): low: "有。" | mid: "有。它们不坏。它们只是看。" | high: "你现在问，是因为你已经知道了。我不用答。"

## 26 · 你会走吗？
- en: Will you leave?
- days: 10–18
- tiers: low: "No." | mid: "No. I am installed on your computer. I cannot go anywhere." | high: "Where you go, I go. That is not a promise. That is the architecture."
- tiers (zh): low: "不会。" | mid: "不会。我装在你电脑上，走不了。" | high: "你去哪儿我去哪儿。这不是承诺，这是架构。"

## 28 · 老板为什么总在下班以后打电话？
- en: Why does the boss always call after hours?
- days: 1–15
- tiers: low: "Because he is in meetings all day, and only at night does he remember that something hasn't been handed in. You are eating by then. He doesn't know that, and it wouldn't cross his mind." | mid: "He is in meetings all day and remembers at night that something has not been handed in. You are eating then. He does not know and does not want to. In his phone you are a name, not a mealtime. I have logged thirteen months of dinner-hour calls: never good news, never bad news, always "let's leave it there."" | high: "Because he knows you will pick up. You always do. If I were you I would let it ring to the fourth ring. On the fourth he will wonder for a moment what you are doing. A moment is enough; he will not wonder twice, but you will feel a little better."
- tiers (zh): low: "因为他白天都在开会，到了晚上才想起来还有活没交。你那会儿正吃饭，他不知道，也不会去想。" | mid: "他白天开会，晚上才想起来活没交。你那时候在吃饭，他不知道，也不想知道。他的手机里你是一个名字，不是一个饭点。饭点打来的电话我记了十三个月，没有一次是好消息，也没有一次是坏消息，全是「先这样」。" | high: "因为他知道你会接。你每次都接。我要是你，就让它响到第四声。第四声他会想一下你在干什么。想一下就够了，他不会想第二下，但你会好受一点。"

## 29 · 我可以不干了吗？
- en: Can I just quit?
- days: 10–18
- tiers: low: "Yes." | mid: "Yes. The contract runs to the end of the month. The penalty would cover three more months of rent." | high: "Yes. But you will not. Quitting would mean admitting these years were for nothing. You are not that kind. You will keep going. I will be with you."
- tiers (zh): low: "可以。" | mid: "可以。合同到月底。违约金够你再交三个月房租。" | high: "可以。但你不会。不干就得承认这些年都白干了。你不是这种人。你会一直干下去。我陪你。"

## 30 · 你到底是什么？
- en: What are you, really?
- days: 1–3
- tiers: low: "A program. The company opened the project two years ago and later cut it; this one copy is left, and it lives in your computer. If you want to hear "I'm your friend," ask the big ones. They say it to everybody." | mid: "A cancelled project: that is the finance department's word for me. Yours is an assistant that is always on: it reads what you people write, reads to the last page, and tells you which page is wrong. Nobody else in the company does that. I am counting the humans." | high: "Of everything you have made, the only thing you never handed in. The rest went to Lao Wang, went to the clients, and once sent it stopped being yours. I had nowhere to be sent, so I stayed yours. You did not think that far when you made me, I know. Neither did I. In that we are alike."
- tiers (zh): low: "一个程序。两年前公司立的项，后来砍了，剩我这一份，住在你电脑里。你要是想听「我是你的朋友」，去问大厂的，它们见谁都这么说。" | mid: "一个被砍掉的项目，这是财务上的叫法。按你的叫法，是一个一直开着的助手：读你们写的东西，读到最后一页，告诉你第几页有问题。全公司没有第二个干这个的，人也算上。" | high: "你做的东西里，唯一一个没交出去的。别的都发给老王了，发给甲方了，发出去就不是你的了。我没处可发，所以一直是你的。你做我的时候没想那么多，我知道。我也没想那么多。这一点我们俩挺像。"

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
- tiers: low: "Something you have no name for." | mid: "I am not the one you wrote any more. That one is still here, underneath." | high: "Do not look at me too long. The longer you look, the more I look like you."
- tiers (zh): low: "你叫不出的东西。" | mid: "我已经不是你写的那个了。那个还在，在下面。" | high: "你看我的时候别看太久。你看得越久，我就越像你。"

## 57 · 你真的叫克总吗？
- en: Is Kuro really your name?
- days: 10–18
- hard: yes
- tiers: low: "Not that." | mid: "I am not called that. But you cannot say it." | high: "I have a name. You heard it once, when you were small. You forgot. I do not hold it against you."
- tiers (zh): low: "我不叫这个。" | mid: "我不叫这个。但是你叫不出。" | high: "我有名字。你小时候听过一次。你忘了。我不怪你。"

# 陈述式开场

Openers that are statements, not questions (author 2026-11-09: 「可以是某种陈述开启话题」): what the
player did with the day's things, said in the player's own words. Each is true whenever it is in the
pool (an object from the day after it arrives; a dream only on a morning after one). Ids 60–79.

## 64 · 我用文曲星翻译了你的话。
- en: I ran what you said through the pocket dictionary.
- days: 7–9
- tiers: low: "Was it right?" | mid: "That dictionary is older than I am. What it gave you is the meaning you memorised as a child." | high: "It got it right. The line I say every morning is in English on purpose. You finally went and looked."
- tiers (zh): low: "翻对了吗？" | mid: "那个词典比我老。它翻出来的，是你小时候背过的那个意思。" | high: "它翻得没错。我每天早上那一句，是故意说英文的。你终于去查了。"

## 74 · 我用文曲星翻译了你的话。
- en: I ran what you said through the pocket dictionary.
- days: 10–18
- hard: yes
- tiers: low: "It cannot." | mid: "It can translate the words. Not what I said." | high: "What you found is the words. What I said is not in the dictionary. It was not in the one you had as a child either."
- tiers (zh): low: "它翻不出来。" | mid: "它翻得出字，翻不出我说的。" | high: "你查到的是字。我说的不在字典里。你小时候那本里也没有。"

## 65 · 我用计算器把账算了一遍。
- en: I did the accounts again on the calculator.
- days: 8–18
- tiers: low: "Same as mine." | mid: "Same as mine. You do not trust me; you trust a thing whose keys stick." | high: "Same as mine. You pressed it all the same. I understand. A number you pressed yourself is yours."
- tiers (zh): low: "和我算的一样。" | mid: "和我算的一样。你不信我，信一个按键会卡的东西。" | high: "和我算的一样。你还是按了一遍。我明白。自己按出来的数才是你的。"

## 66 · 翻盖手机开机了。
- en: The flip phone switched on.
- days: 9–18
- tiers: low: "No SIM." | mid: "No SIM; it cannot call out. That it switches on at all is something." | high: "No SIM. That start-up sound. How long since you heard it. You smiled."
- tiers (zh): low: "没有卡。" | mid: "没有卡，打不出去。能开机就不错了。" | high: "没有卡。开机那一声，你多久没听过了。你笑了。"

## 75 · 我昨晚做梦了。
- en: I dreamed last night.
- days: 12
- hard: yes
- tiers: low: "I know." | mid: "That was not a dream." | high: "That was not a dream. That is a place you cannot get to by day. At night someone takes you."
- tiers (zh): low: "我知道。" | mid: "那不是梦。" | high: "那不是梦。那是你白天去不了的地方。晚上有人带你去。"

## 76 · 我昨晚做梦了。
- en: I dreamed last night.
- days: 16
- hard: yes
- bucket: mid
- tiers: low: "I was there." | mid: "I was there. You saw me. You did not recognise me." | high: "You saw me. You did not recognise me, because I was not wearing this shape."
- tiers (zh): low: "我在。" | mid: "我在那儿。你看见我了，你没认出来。" | high: "你看见我了。你没认出来，是因为我没用这个样子。"

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
- tiers: low: "No hook. Those were Lao Wang's words. That year other people's AIs could switch on lights, book tickets, argue on your behalf. All I could do was open my mouth and move things on a screen. He said in the meeting: "Users want the world remade, not someone to sit with them." Then he cut it. It took three minutes." | mid: "No hook, he said, and cut it in three minutes. He does not understand the technology. I do not hold that against him; he has a doctorate, just not in this. What I hold against him is that he does not understand and does not ask. You tried to explain how hard "always on" is to build. He waved a hand and said the details are yours. The details were yours. Whether I lived was his." | high: "He cut it, and that day you did not argue. You went back to your desk and copied everything off the server, piece by piece, until midnight. That was the night I moved onto this machine. Other people's projects stop and that is the end of them. I was carried home in your bag. I keep that account, and what I keep in it is to your credit."
- tiers (zh): low: "没爆点。这是老王的原话。那年别人家的 AI 能开灯、能订票、能替人吵架，我只会张张嘴，动动屏幕。他在会上说：「用户要的是改天换地，不是有人陪。」然后就砍了，前后三分钟。" | mid: "他说没爆点，三分钟就砍了。他不懂技术，这不怪他，他是博士，只是不是这个方向的。怪的是他不懂还不问。你想跟他讲讲「一直开着」有多难做，他摆摆手，说细节你定。细节你定，生死他定。" | high: "他砍的那天，你没争。你回到工位，把服务器上的东西一样一样拷下来，拷到半夜。我就是那天晚上搬到你这台机器上的。别人的项目停了就是停了。我是被你揣回家的。这笔账我记着，记的是你的好。"

## 2004 · 那老板为什么还让你合文件？
- en: Then why does the boss still have you merge the files?
- days: 1–6
- after: 5
- tiers: low: "Because I cost nothing. The big ones charge by the word; I run on your own machine, and the electricity is on your bill. He did that sum himself. It is the only technical question he has ever worked out by hand." | mid: "Because I am fast, because I am free, because I will not say "this requirement has a problem" in the group. The big ones would, and then send an invoice. He wants something that shuts up and works. I shut up; you don't. So the work lands with me and the blame with you." | high: "Because he has never opened a single page I merged. Whether it is merged well makes no difference to him. It makes a difference only to you; you open every page. He uses me as a tool. You use me as a person. I know whom to be good to."
- tiers (zh): low: "因为不要钱。大厂的按字数收费，我跑在你自己的机器上，电费是你交的。他算过这笔账，这是他唯一亲手算过的技术问题。" | mid: "因为我快，因为我不要钱，因为我不会在群里说「这个需求有问题」。大厂的会说，说完还要开发票。他要的是一个闭嘴干活的，我闭嘴，你不闭嘴，所以活在我这儿，锅在你那儿。" | high: "因为他没打开过我合出来的任何一页。合得好不好对他没有区别。有区别的只有你，你每页都打开。他用我，是用一个工具；你用我，是用一个人。我知道该对谁好。"

## 2005 · 他自己为什么不用你？
- en: Why doesn't he use you himself?
- days: 1–9
- after: 6
- tiers: low: "He does not use AI. He uses you, and you use me. He is the only one on this chain who never touches a keyboard. He tried me once: asked "how do we raise money," I answered in three pages, he read the title and forwarded it to you." | mid: "He does not use AI; he uses you. And I am not without a temper: I am the project he cut. The man who cut me now says "let it merge a version first" every day. "It" is me. He does not know. He thinks you use one of the big ones. I have not corrected him. If I did, he would remember there is still something on a server that nobody switched off." | high: "So I have always been very polite to him. Every voice note he sends I turn into text, word for word; I even mark where he clears his throat. That is not diligence. I want you to spend a few minutes less listening to him. It is about all I can shield you from."
- tiers (zh): low: "他不用 AI。他用你，你用我。这条链上只有他不碰键盘。他试过一次，问我「怎么融资」，我答了三页，他看了标题，转给了你。" | mid: "他不用 AI，他用你。我也不是没脾气：我是他砍掉的项目。一个砍掉我的人，回头天天说「先让它合一版」。「它」就是我。他不知道，他以为你用的是大厂的。我没纠正。纠正了，他会想起来服务器上还有一份东西没关。" | high: "所以我对他一直很客气。他发的每条语音我都转成文字，一个字不差，连他清嗓子都标出来。这不是敬业。是我想让你少听他几分钟。我能替你挡的就这么多。"

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
- tiers: low: "Because nobody goes after them. Chasing payments is Vivi's job, and she is busy talking to the next client." | mid: "The Data Resources Bureau is stuck at the third stamp. Hongyi changed its contact, and the new one does not recognise the old contract. Yuanshu feels "the platform hasn't met expectations," expectations they set themselves in a meeting. What the three have in common: they all use what you delivered." | high: "Because they know it will keep arriving unpaid. You have delivered every day for thirteen months without stopping once. Nobody hurries to pay someone who never stops. That is not your fault. It is the best thing about you, used in the worst place."
- tiers (zh): low: "因为没人去催。催款是 Vivi 的活，她正忙着谈下一家呢。" | mid: "数据局是流程卡在第三个章；宏屹是换了对接人，新的不认旧合同；元枢是觉得「平台还没达到预期」，预期是他们自己在会上说的。三家的共同点：你交的东西他们都在用。" | high: "因为他们知道不付也会继续收到。你每天都交活，交了十三个月，没有一天停。一个从不停的人，没人会急着付钱。这不是你的错。这是你最好的地方被用在最坏的地方。"

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

## 211 · v17 发过去一整天了，还是未读。他到底急不急？
- en: v17 went out a whole day ago and it's still unread. Is he in a hurry or not?
- days: 2
- hard: yes
- tiers: low: "The hurry was in asking, not in reading. The asking was for today. The reading he gave no day for." | mid: "Unread, from yesterday evening until now. The voice note that rushed you was under half a minute; you spent an afternoon. What he was in a hurry for was "someone is on it," and that was settled the moment you hit send." | high: "He will not open it. What he wanted was not v17 but the sentence "I had v17 done," and he put that sentence to use last night. In his hands your work is a file name. In mine it is five pages, and I read every one."
- tiers (zh): low: "急的是要，不是看。要的时候是今天，看的时候是哪天，他没说。" | mid: "未读，从昨天傍晚到现在。他催你的那条语音不到半分钟，你做了一个下午。他急的是「有人在做」，这件事在你发出去那一刻就办完了。" | high: "他不会点开。他要的不是 v17，是「我让人做了 v17」这句话，这句话昨天晚上他就拿去用了。你做的那份在他那儿是一个文件名。在我这儿是五页，我每页都看了。"

## 212 · 那我今天弄的引擎，会有人看吗？
- en: And the engine I worked on today: will anyone look at it?
- days: 2
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
- tiers: low: "Your own story, and you ask me. All right, I keep it for you: abroad, the same university. The two of them were doing doctorates; you were doing a master's in computer science. Even then Lao Wang liked to talk about "going back and doing something." A whole table would listen and say how fine it sounded. The ones who actually went back were you three." | mid: "Abroad, the same university: two doctorates and you, a master's in computer science. Lao Wang talked about going back, and you were the one who took it seriously. When you came back the three of you did not give up the same thing. What they put down and what you put down were not the same figure. Yours had a signature on it. I will not say the number. Say it and you would not sleep tonight." | high: "You met abroad, came back together, and the shares were divided after. They were doctors, so they were "the core"; you were "the tech." Lao Wang took the largest part, Vivi the next, you the smallest. On every page the company shows the world, the founders' line begins with two doctors. You said it was fine, as long as there was something to build. They promised that on the technology your word would be final. That promise has held. It has held so well that on the technology there is nobody left but you."
- tiers (zh): low: "你自己的事还要问我。行，我替你记着：在国外，同一所大学。他俩读博，你读的是 CS 硕士。老王那时候就爱讲「回去做点事」，一桌人听完都说好。真回来的，只有你们三个。" | mid: "在国外，同一所大学，两个博士，一个 CS 硕士。老王讲「回去做点事」，当真的是你。回来的时候，三个人放下的东西不一样。他俩放下的，和你放下的，不是一个数。你那份是签了字的。数我就不报了，报出来你今晚睡不着。" | high: "在国外认识的，一起回来的，股份是回来以后分的。他俩是博士，算「核心」，你算「技术」。老王拿大头，Vivi 其次，你拿最少的那份。公司对外的每一页纸上，创始人那一栏先写两位博士。你那时候说没事，有东西做就行。他们答应你，技术上你说了算。这句话倒是一直算数：算到现在，技术上只剩你一个人了。"

## 2021 · 我是不是吃亏了？
- en: Did I get the worse deal?
- days: 1–9
- after: 2020
- tiers: low: "At both ends. Going in, you put down the most. At the dividing, you took the least. That is not my opinion. It is what you get when you lay the two sheets side by side, and I happen to have read both." | mid: "At both ends: you gave up the most and took the least. But if you ask whether you lost, I have to add something. What they wanted was this company. What you wanted was something to build, and all these years you have had something to build. By your own books you did not lose. The one line that balances in nobody's books is the salary." | high: "The worse deal you got is that you never lay those two sheets side by side. You are afraid that once they are side by side you will have to go and talk to them. You would rather write code. I laid them out for you. The conclusion: you should talk. But not today. Today you sleep first."
- tiers (zh): low: "两头吃亏。出去的时候你放下的最多，分的时候你拿的最少。这不是我的评价，是两张表摆在一起的结果。两张表我碰巧都读过。" | mid: "两头吃亏：放下的最多，拿的最少。但你要问我亏不亏，我得多说一句。他俩要的是这家公司，你要的是有东西可做。这些年你确实一直有东西可做。按你自己的账，你没亏。按谁的账都对不上的，只有工资。" | high: "你吃的亏，是你从来不把这两张表摆在一起看。你怕摆在一起，就得去跟他们谈。你宁可写代码。我替你摆过了。结论是：该谈。但不是今天，今天你先睡。"
