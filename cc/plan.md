to implement: 

- the main bot should just be the telegram chat sdk
- transcribe https://ai-sdk.dev/docs/ai-sdk-core/transcription for when i send voice memos on telegram
- make a .env.template with things i need to fill out

the bot really only needs two things: 
- when i send a link, the bot should add it to some sqlite table with the right tag, see tag options in ~/Programming/sinnoh/obsidian/notes.md
  - include my thoughts as bullet points beneath the link too
- when i send a voice memo, the bot should add the transcription to some sqlite table
- when i send long texts that are like rambly thoughts, it can add that to an sqlite table
- it sends me a calendar rundown at 9:30 est every day
- it sends me a reminder of my todos every 3 hours
  - maybe use the google tasks api for this

- for agent capabilities...im thinking, not many? 
  - sending a link with some text should auto parse and sort into a table
  - same with thoughts, transcriptions
  - calendar and todos can just be single model calls
  - i could maybe have a /session command that starts a basic agent convo that i can close with /end or smtn. not sure if that's feasible, are there timeouts on the worker? i guess we could keep the message history in a table or smtn
  - tasks, i guess i might do like. /task and then write a description of waht i want and taht starts a session if the agent has clarifying questions or else it just sorts it away

will port notes.md and obsidian/thoughts/unsorted.md to sqlite and stuff i think

and also impl cloudflare worker running a simple site where i can view the data in these tables, too :)