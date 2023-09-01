/* Omada DNS
 * DNS resolution of DHCP reserved names using the omada-controller-api
 * (c)copyright 2023 by Gerald Wodni <gerald.wodni@gmail.com>
 */

const dns2 = require( "dns2" );
const { DOHClient, Packet } = dns2;
const Omada = require( "./omada" );

const resolve = DOHClient({
    dns: process.env.OMADA_DNS_RESOLVE || "8.8.8.8",
});

const TypeNumToString = Object.keys(Packet.TYPE).reduce( (obj, key) => {
    obj[Packet.TYPE[key]] = key;
    return obj;
}, {} )
const ClassNumToString = Object.keys(Packet.CLASS).reduce( (obj, key) => {
    obj[Packet.CLASS[key]] = key;
    return obj;
}, {} )


let localAnswers = {
    "blue-light": {
        address: "1.1.1.1",
    }
}

function getLocalAnswers( name, typeString, classString ) {
    if( typeString != "A" || classString != "IN" )
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

        //console.log( "New request:", req, typeString, classString );
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

    const omada = new Omada({
        host: process.env.OMADA_HOST,
        port: process.env.OMADA_PORT,
        site: process.env.OMADA_SITE,
        username: process.env.OMADA_USERNAME,
        password: process.env.OMADA_PASSWORD,
    });

    /* refresh by interval */
    const interval = ( process.env.OMADA_INTERVAL || 10 ) * 1000;
    async function updateOmadaLocalAnswers() {
        try {
            localAnswers = await omada.getDnsLocalAnswers();
            console.log( "Got omada update:", localAnswers );
        } catch( err ) {
            console.log( "Update Omada local answers error:", err );
        }
        setTimeout( updateOmadaLocalAnswers, interval );
    }
    setTimeout( updateOmadaLocalAnswers, 1000 );
});

const address = process.env.OMADA_DNS_ADDRESS || "0.0.0.0";
const port    = process.env.OMADA_DNS_PORT || 53;
server.listen({
    udp: { 
        port,
        address,
        type: "udp4",
    },
  
    tcp: { 
        port,
        address,
    },
});

