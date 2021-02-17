import { MachineConfig, send, Action, assign } from "xstate";


function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}

function listen(): Action<SDSContext, SDSEvent> {
    return send('LISTEN')
}


function promptAndAsk(prompt: string): MachineConfig<SDSContext, any, SDSEvent> {
    return ({
        initial: 'prompt',
        states: {
            prompt: {
                entry: say(prompt),
                on: { ENDSPEECH : 'ask' }
            },
            ask: {
                entry: send('LISTEN'),
            },
        }})
}

const grammar: { [index: string]: { person?: string, day?: string, time?: string } } = {
    "John": { person: "John Appleseed" },
    "William": { person: "William Windmill "},
    "Patrick": { person: "Patrick Wong" }, 
    "Eva": { person: "Eva Thompson"},
    "My father": { person: "your father" },

    "on Monday": { day: "Monday" },
    "on Tuesday": { day: "Tuesday" },
    "on Wednesday": { day: "Wednesday" },
    "on Thursday": { day: "Thursday" },
    "on Friday": { day: "Friday" },
    "on Saturday": { day: "Saturday" },
    "on Sunday": { day: "Sunday" },

    "at eight": { time: "08:00" },
    "at nine": { time: "09:00" },
    "at ten": { time: "10:00" },
    "at eleven": { time: "11:00" },
    "at twelve": { time: "12:00" },
    "at one": { time: "13:00" },
    "at two": { time: "14:00" },
    "at three": { time: "15:00" },
    "at four": { time: "16:00" },
    "at five o'clock": { time: "17:00" },

}

const grammar2: { [index: string]: { affirm?: string, deny?: string } } = {
    "Yes": { affirm: "yes" },
    "yes": { affirm: "yes" },
    "indeed": { affirm: "yes" },
    "that sounds good": { affirm: "yes" },
    "yes of course": { affirm: "yes" },
    "absolutely": { affirm: "yes" },
    "of course": { affirm: "yes" },

    "No": { deny: "no"}, 
    "n": { deny: "no"},
    "I don't think so": { deny: "no"},
    "no": { deny: "no" },
    "never": { deny: "no"},
    "not really": { deny: "no"},
    "no way": { deny: "no" }

}

const proxyurl = "https://cors-anywhere.herokuapp.com/";
const rasaurl = 'https://ds-lab2.herokuapp.com/model/parse'
const nluRequest = (query: string) =>
    fetch(new Request(proxyurl + rasaurl, {
        method: 'POST',
        headers: { 'Origin': 'http://maraev.me' }, // only required with proxy
        body: `{"text": "${query}"}`
    }))
        .then(data => data.json());

export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = ({
    initial: 'init',
    states: {
        init: {
            on: {
                CLICK: 'welcome'
            }
        },
        welcome: {
            initial: "prompt",
            on: {
                RECOGNISED: {
                    actions: assign ((context) => { return { query: context.recResult } }),
                    target: "query"
                }
            },
            ...promptAndAsk ('What would you like to do?')
        },
        query: {
            invoke:{
                id: 'rasa',
                src: (context) => nluRequest(context.query),
                onDone: [
                    {cond: (context) => context === "appointment",
	                target: "who"},
	                {target: "welcomemessage" },                 
                ],
                onError: "welcome"
            }
        },
        welcomemessage: {
            entry: say ("Okay."),
            always: "init"

        },
        who: {
            initial: "prompt",
            on: {
                RECOGNISED: [{
                    cond: (context) => "person" in (grammar[context.recResult] || {}),
                    actions: assign((context) => { return { person: grammar[context.recResult].person } }),
                    target: "day"

                },
                { target: ".nomatch" }]
            },
            states: {
                prompt: {
                    entry: say("Who are you meeting with?"),
                    on: { ENDSPEECH: "ask" }
                },
                ask: {
                    entry: listen()
                },
                nomatch: {
                    entry: say("Sorry I don't know them"),
                    on: { ENDSPEECH: "prompt" }
                }
            }
        },
        day: {
            initial: "prompt",
            on: {
                RECOGNISED: [{
                    cond: (context) => "day" in (grammar[context.recResult] || {}),
                    actions: assign((context) => { return { day: grammar[context.recResult].day } }),
                    target: "is_whole"

                },
                { target: ".nomatch" }]
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `OK. ${context.person}. On which day is your meeting?`})),
                    on: {ENDSPEECH: "ask"}
                },
                ask: {
                    entry: listen()
                },
                nomatch: {
                    entry: say("I didn't get you."),
                    on: { ENDSPEECH: "prompt" }
                }
            }
        },
        is_whole:{
            initial: "prompt",
            on: {
                RECOGNISED: [{
                    cond: (context) => "affirm" in (grammar2[context.recResult] || {}),
                    target: "confirm_whole"
                },
                {
                    cond: (context) => "deny" in (grammar2[context.recResult] || {}),
                    target: "time"
                },
                { target: ".nomatch"}]
            },
            states: {
                prompt: {
                    entry: say("Will it take the whole day?"),
                    on: { ENDSPEECH: "ask" }
                },
                ask: {
                    entry: listen()
                },
                nomatch: {
                    entry: say("I didn't get it."),
                    on: { ENDSPEECH: "prompt" }
                }
            }
        },
        time: {
            initial: "prompt",
            on: { 
                RECOGNISED: [{
                    cond: (context) => "time" in (grammar[context.recResult] || {}),
                    actions: assign((context) => { return { time: grammar[context.recResult].time } }),
                    target: "confirm_time"
                
                },
                {target: ".nomatch"}]
            },
            states: {
                prompt: {
                    entry: say("What time is your meeting?"),
                    on: { ENDSPEECH: "ask"}
                },
                ask: {
                    entry: listen()
                },
                nomatch: {
                    entry: say("Could you repeat that?"),
                    on: { ENDSPEECH: "prompt" }
                }
            }
        },
        confirm_time:{
            initial: "prompt",
            on: {
                RECOGNISED: [{
                    cond: (context) => "affirm" in (grammar2[context.recResult] || {}),
                    target: "end"
                },
                {
                    cond: (context) => "deny" in (grammar2[context.recResult] || {}),
                    target: "who"
                },
                { target: ".nomatch"}]
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `Do you want me to create an appointment with ${context.person} on ${context.day} at ${context.time}?` })),
                    on: {ENDSPEECH: "ask"}
                },
                ask: {
                    entry: listen()
                },
                nomatch: {
                    entry: say("Excuse me?"),
                    on: { ENDSPEECH: "prompt" }
                }
            }
        },
        confirm_whole:{
            initial: "prompt",
            on: {
                RECOGNISED: [{
                    cond: (context) => "affirm" in (grammar2[context.recResult] || {}),
                    target: "end"
                },
                {
                    cond: (context) => "deny" in (grammar2[context.recResult] || {}),
                    target: "who"
                },
                { target: ".nomatch"}]
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `Do you want me to create an appointment with ${context.person} on ${context.day} for the whole day?`,
                    })),
                    on: {ENDSPEECH: "ask"}
                },
                ask: {
                    entry: listen()
                },
                nomatch: {
                    entry: say("Excuse me?"),
                    on: { ENDSPEECH: "prompt" }
                }
            }
        },
        end: {
            entry: say("Your appointment has been created."),
            always: 'init'
        }
    }
})

