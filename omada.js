const https = require("https");
const path = require("path");
const util = require("util");

class Omada {
    constructor( opts ) {
        /* configuration */
        this.host = opts.host;
        this.port = opts.port || 443;
        this.siteName = opts.site;
        this.username = opts.username;
        this.password = opts.password;

        /* runtime */
        this.apiPrefix = "/api";
        this.id = null;
        this.token = null;
        this.cookies = {};
        this.siteId = null;
    }

    makeRequest( httpMethod, httpPath, body = null ) {
        return new Promise( ( fulfill, reject ) => {
            const headers = {
                'Accept': 'application/json',
                'User-Agent': 'omada-dns.js',
                //'Authorization': opts.api_key
            }

            /* augment header with type & csrf */
            if( httpMethod == "POST" )
                headers['Content-Type'] = 'application/json';

            if( this.token != null ) {
                headers['Csrf-Token'] = this.token;
            }

            if( this.siteId != null )
                httpPath = httpPath.replace( /\{SITEID\}/g, this.siteId );
            else
                httpPath = httpPath.replace( /\{SITEID\}/g, 'null' );

            /* add cookies */
            if( Object.keys(this.cookies).length > 0 ) {
                let cookieText = "";
                for( const[name, value] of Object.entries( this.cookies ) )
                    cookieText += `${name}=${value};`
                headers['Cookie'] = cookieText;
            }

            const req = https.request({
                method: httpMethod,
                //path: path.join( this.apiPrefix, httpPath ),
                path: httpPath,
                host: this.host,
                port: this.port,
                rejectUnauthorized: false,
                headers,
            }, res => {
                let data = [];

                /* save cookies */
                if( res.headers.hasOwnProperty('set-cookie') ) {
                    res.headers['set-cookie'].forEach( cookie => {
                        const cookieStart = cookie.split(";")[0];
                        const [name, value] = cookieStart.split("=");
                        this.cookies[ name ] = value;
                    });
                }

                //console.log( "RES:", httpPath, res.statusCode, res.headers );
                if( res.statusCode >= 300 && res.statusCode <= 399 && res.headers.location.indexOf( "/login" ) > 0 )
                    return reject( new Error( "Login redirect" ) );

                res.on("data", chunk => data.push( chunk ) );
                res.on("end", () => {
                    data = data.join("");
                    const obj = JSON.parse( data );
                    if( obj.errorCode != 0 ) {
                        const err = new Error( `${obj.errorCode}: ${obj.msg}` );
                        err.data = obj;
                        return reject( err );
                    }
                    fulfill( obj.result );
                });
            });

            req.on("error", reject);

            if( body != null )
                req.write( JSON.stringify(body) );

            req.end();
        });
    }

    makeIdRequest( httpMethod, httpPath, body = null ) {
        httpPath = path.join( "/" + this.id, "api/v2", httpPath );
        return this.makeRequest( httpMethod, httpPath, body );
    }

    async makeAutoLoginIdRequest( httpMethod, httpPath, body = null ) {
        try {
            return await this.makeIdRequest( httpMethod, httpPath, body );
        } catch( err ) {
            if( err.message != "Login redirect" )
                throw err;

            /* reset cookies & token */
            this.cookies = [];
            this.token = null;

            console.log( "Logging into omada..." );
            /* id (always accessible)? */
            if( this.id == null )
                this.id = await this.getId();

            /* login! */
            await this.login( this.username, this.password );

            /* site id? */
            if( this.siteId == null )
                await this.getSites();

            return this.makeIdRequest( httpMethod, httpPath, body );
        }
    }

    /* convenience wrappers */
    get ( httpPath )        {  return this.makeAutoLoginIdRequest( "GET", httpPath          );  }
    post( httpPath, body )  {  return this.makeAutoLoginIdRequest( "POST", httpPath, body   );  }

    /* api implementation */
    async getId() {
        return (await this.makeRequest( "GET", "/api/info" )).omadacId
    }

    async login( username, password ) {
        const login = await this.makeIdRequest( "POST", "login", { username, password } );
        this.token = login.token;
        return login;
    }

    async getSites() {
        this.sites = (await this.get("users/current")).privilege.sites.reduce( (obj, {name, key}) => {
            obj[ name ] = key;
            return obj;
        }, {});

        if( this.sites.hasOwnProperty( this.siteName ) )
            this.siteId = this.sites[ this.siteName ];

        return this.sites;
    }

    async getNetworks() {
        return await this.get(`sites/{SITEID}/setting/lan/networks?currentPage=1&currentPageSize=999`);
    }

    async getDevices() {
        return await this.get(`sites/{SITEID}/devices?currentPage=1&currentPageSize=999`);
    }

    async getDhcpReservations() {
        return await this.get(`sites/{SITEID}/setting/service/dhcp?currentPage=1&currentPageSize=999`);
    }

    /* specific DNS interface: get all DHCP reservations and their respective network domains */
    async getDnsLocalAnswers() {
        const networks = (await this.getNetworks()).data.reduce( (obj, n) => {
            obj[ n.id ] = {
                name: n.name,
                domain: n.domain,
            }
            return obj;
        }, {});

        const dhcpReservations = (await this.getDhcpReservations()).data;

        const localAnswers = {};
        for( let r of dhcpReservations ) {
            const names = [];
            names.push( r.description );
            names.push( r.mac );
            if( r.clientName != r.mac )
                names.push( r.clientName );

            const domain = networks[ r.netId ].domain;
            const obj = { address: r.ip };

            for( let name of names ) {
                localAnswers[ name.toLowerCase() ] = obj;
                localAnswers[ `${name}.${domain}`.toLowerCase() ] = obj;
            }
        }

        return localAnswers;
    }
    
    async test() {
        try {
            console.log( "Networks:", await this.getNetworks() );
            console.log( "Local Answers:", await this.getDnsLocalAnswers() );
        } catch( err ) {
            console.log( "Error:", err );
        }
    }
}

module.exports = Omada;

/* quick test: displays current localAnswers, and some bonus information */
if( require.main == module ) {
    (new Omada({
        host: process.env.OMADA_HOST,
        port: process.env.OMADA_PORT,
        site: process.env.OMADA_SITE,
        username: process.env.OMADA_USERNAME,
        password: process.env.OMADA_PASSWORD,
    })).test();
}

