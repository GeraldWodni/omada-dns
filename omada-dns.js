const dns2 = require('dns2');
const { DOHClient, Packet } = dns2;

const resolve = DOHClient({
    dns: '8.8.8.8',
});

const TypeNumToString = Object.keys(Packet.TYPE).reduce( (obj, key) => {
    obj[Packet.TYPE[key]] = key;
    return obj;
}, {} )
const ClassNumToString = Object.keys(Packet.CLASS).reduce( (obj, key) => {
    obj[Packet.CLASS[key]] = key;
    return obj;
}, {} )


const localAnswers = {
    "apple": {
        address: '10.7.9.33',
    }
}

function getLocalAnswers( name, typeString, classString ) {
    if( typeString != 'A' || classString != 'IN' )
        return null;

    if( !localAnswers.hasOwnProperty( name ) )
        return null;

    const localAnswer = localAnswers[name];
    return [{
        name,
        type: Packet.TYPE.A,
        class: Packet.CLASS.IN,
        ttl: localAnswers.ttl || 301,
        address: localAnswer.address,
    }]
}

const server = dns2.createServer({
    udp: true,
    handle: async ( req, send, rinfo ) => {
        const response = Packet.createResponseFromRequest(req);
        const [ question ] = req.questions;
        const name = question.name;
        const typeString  = TypeNumToString [ question.type  ];
        const classString = ClassNumToString[ question.class ];

        console.log( "New request:", req, typeString, classString );
        const localAnswers = getLocalAnswers( name, typeString, classString );
        if( localAnswers != null ) {
            console.log( "Local result:", localAnswers );
            response.answers = localAnswers;
        }
        else {
            const result = await resolve( name, typeString );//, classString );
            console.log( "Answer:", result.answers );
            response.answers = result.answers;
        }

        send(response);
    }
});

server.on( "requestError", err => {
  console.log( "Client sent an invalid request", err );
});

server.on( "listening", () => {
  console.log( "Listening on", server.addresses() );
});

server.listen({
  udp: { 
    port: 5333,
    address: "127.0.0.1",
    type: "udp4",
  },
  
  tcp: { 
    port: 5333,
    address: "127.0.0.1",
  },
});

