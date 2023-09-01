const https = require("https");
const path = require("path");
const util = require("util");

class Omada {
    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.apiPrefix = "/api";
        this.id = null;
        this.token = null;
        this.cookies = {};
        this.siteName = 'Vienna';
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
                    console.log( this.cookies );
                }

                //console.log( "RES:", httpPath, res.statusCode, res.headers );
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

    makeAutoLoginRequest( httpMethod, httpPath, body = null ) {
    }

    get ( httpPath )        {  return this.makeIdRequest( "GET", httpPath         );  }
    post( httpPath, body )  {  return this.makeIdRequest( "POST", httpPath, body  );  }

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
        return await this.get(`sites/${this.siteId}/setting/lan/networks?currentPage=1&currentPageSize=999`);
    }

    async getDevices() {
        return await this.get(`sites/${this.siteId}/devices?currentPage=1&currentPageSize=999`);
    }

    async getDhcpReservations() {
        return await this.get(`sites/${this.siteId}/setting/service/dhcp?currentPage=1&currentPageSize=999`);
    }
    
    async run() {
        try {
            this.id = await this.getId();
            console.log( "Id:", this.id );

            const test = await this.get(`/anon/initialization`);
            console.log( "Test:", test );

            const login = await this.login( "user", "password" );
            console.log( "login:", login );

            const sites = await this.getSites();
            console.log( "sites INSP:", util.inspect(sites, {depth: null}) );

            const networks = await this.getNetworks();
            console.log( "networks:", util.inspect(networks, {depth: null}) );

            const devices = await this.getDevices();
            console.log( "devices:", util.inspect(devices, {depth: null}) );

            const dhcpReservations = await this.getDhcpReservations();
            console.log( "devices:", util.inspect(dhcpReservations, {depth: null}) );
        } catch( err ) {
            console.log( "Error:", err );
        }
    }
}

(new Omada("10.0.0.2", 8443)).run();

