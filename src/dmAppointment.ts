import { MachineConfig, send, Action, assign } from "xstate";
import "./styles.scss";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { useMachine, asEffect } from "@xstate/react";
import { inspect } from "@xstate/inspect";

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

const grammar2: { [index: string]: boolean } = {
    "Yes": true,
    "yes": true,
    "indeed": true,
    "that sounds good": true,
    "yes of course": true,
    "absolutely": true,
    "of course": true,

    "No": false, 
    "n": false,
    "I don't think so": false,
    "no": false,
    "never": false,
    "not really": false,
    "no way": false

}

let a = grammar2["yes"]
let b = grammar2["no"]



export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = ({
    initial: 'init',
    states: {
        init: {
            on: {
                CLICK: 'welcome'
            }
        },

        welcome: {
            on: {
                RECOGNISED: {
                    actions: assign ((context) => { return { option: context.recResult } }),
                    target: "query"
                }
            },
            ...promptAndAsk ('What would you like to do?')
        },

        query: {
            invoke:{
                id: 'rasa',
                src: (context, event) => nluRequest(context.option),
                onDone: {
                    target: 'menu',
                    actions: [assign((context, event) => { return  {option: event.data.intent.name} }),
                    (context: SDSContext, event: any) => console.log(event.data)]
                    //actions: assign({ intent: (context: SDSContext, event: any) =>{ return event.data }})
                },
                onError: {
                    target: 'welcome',
                    actions: (context, event) => console.log(event.data)
                }
            }
        },

        menu: {
            initial: "prompt",
            on: {
                ENDSPEECH: [
                    { target: 'welcomemessage', cond: (context) => context.option === 'todo' },
                    { target: 'welcomemessage', cond: (context) => context.option === 'timer' },
                    { target: 'who', cond: (context) => context.option === 'appointment' }
                ]
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `OK.`
                    })),
        },
     /*            nomatch: {
                    entry: say("Sorry, I don't understand"),
                    on: { ENDSPEECH: "prompt" }
        } */ 
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
                    cond: (context) => (grammar2[context.recResult] === a),
                    target: "confirm_whole"
                },
                {
                    cond: (context) => (grammar2[context.recResult] === b),
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
                    cond: (context) => (grammar2[context.recResult] === a),
                    target: "end"
                },
                {
                    cond: (context) => (grammar2[context.recResult] === b),
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
                    cond: (context) => (grammar2[context.recResult] === a),
                    target: "end"
                },
                {
                    cond: (context) => (grammar2[context.recResult] === b),
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

const proxyurl = "https://cors-anywhere.herokuapp.com/";
const rasaurl = 'https://lingqs-intent.herokuapp.com/model/parse'
const nluRequest = (text: string) =>
    fetch(new Request(proxyurl + rasaurl, {
        method: 'POST',
        headers: { 'Origin': 'http://maraev.me' }, // only required with proxy
        body: `{"text": "${text}"}`
    }))
        .then(data => data.json());
