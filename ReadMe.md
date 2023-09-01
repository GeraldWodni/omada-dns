# Omada DNS
This container provides a DNS resolution of DHCP reserved names using the omada-controller-api.

The project is inspired by [coredns-omada-plugin](https://github.com/dougbw/coredns_omada), which is a wonderful project!
However, it did not work on my network, and as I wanted the domains to be auto detected, I thought I'd have a go myself.

Currently the system uses DOH (DNS over HTTPS) to enable a bit more privacy for the end user.


## Function
Omada-dns runs a [dns2](https://www.npmjs.com/package/dns2) based server.
1s after the server starts listening, omada is contacted via API v2 and the networks as well as the DHCP-reservations are collected.

After that the DHCP-reservations are collected in an interval (see OMADA\_INTERVAL).
The reservations are matched against the networks, and combined with the domains.

For example: you have a host with the description `blue`, with the mac address `13-37-BE-EF-21-21`.
The network it resides in has the domain `dabadee.dabadi`.
This will add the following items to the local DNS answers:
- `blue`
- `13-37-be-ef-21-21` (yes lowercase is enforced)
- `blue.dabadee.dabadi`
- `13-37-be-ef-21-21.dabadee.dabadi`

If a client-name is configured (default is the same as the mac-address),
then it is also added to the above list once alone, and once with suffix.


## Configuration
The following environment variables are used:

### `OMADA_DNS_RESOLVE` default: `8.8.8.8`
Sets the DOH resolver, that is used on a miss.
Note: Everything not resolved by your local DHCP reservation is considered a miss.

### `OMADA_DNS_ADDRESS` default: `0.0.0.0`
Interface-address the dns2-server is bound to.

### `OMADA_DNS_PORT` default: `53`
Port thd dns2-server is bound to.

### `OMADA_HOST`
The host of the controller. For example: `192.168.0.42`.

### `OMADA_PORT`
The port of the controller interface.
        
### `OMADA_SITE`
The site you wish to server. For example: `Vienna`.

### `OMADA_USERNAME` and `OMADA_PASSWORD`
Credentials for the controller interface.
Hint: add a viewer-user

### `OMADA_INTERVAL` default: `10`
Interval used for updating the dhcp reservations into the dns-cache

