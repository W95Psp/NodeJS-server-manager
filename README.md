# NodeJS-server-manager
Host multiples NodeJS app on a server, with reverse-proxy built-in
## Warning! 
I build it firstly in a very personal purpose. I've done it quickly to have something working in a small time.
So, the source code is quite the mess, sorry about that, also, there isn't any documentation, and sadly neither any comment in sources :-(

## Sum-up
I'm a big fan of NodeJS, and the thing is I havn't loads of servers to store my apps.

Also, to host my apps, I usually create a daemon on a Linux virtual server, but for maintenance, that's not really convenient.

So, I'm developping this app to help people like me to host easily numerous NodeJS apps.

## Functionalities
If I host numerous apps, I also want to let people access it. I have two domain names, but I have something like twenty apps running on my servers. In order to make my apps and websites visible to everybody, I use a reverse proxy.

So I have a server redirecting every request my IP receive, and this server redirect requests, according to the sub domain name, to various servers and port numbers.

In the past, I used Apache to do that, but that wasn't very pratical. Indeed, it was heavy and not very flexible.

So, I took all my needs and made this "NodeJS-server-manager"

- Run multiples NodeJS programs
- Manage theses NodeJS instances with an unique interface
  - Run, stop, restart and instance
  - View stdout
  - View errors
  - View logs
  - Filter logs / errors / stdout
  - Change redirections (interact with the reverse proxy directly)
- Run a NodeJS powered ReverseProxy (thanks to node-http-proxy!)
  - Add redirections
  - Delete redirections
  - Edit redirections


## Todo list
- [ ] Clean code & ES6
- [ ] Uniformize way of doing stuff
- [ ] Separate interface from everything else
- [ ] Add passwords
- [ ] Make all of that configurable
- [ ] 
