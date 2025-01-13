interface Config {
   database_settings: {
      user: string,
      password: string,
      host: string,
      port: number,
      database: string
   };
   telegram_token: string
}

let config: Config = {
   database_settings:  {
      user: 'user',
      password: 'password',
      host: 'host',
      port: 0,
      database: 'database',
   },
   telegram_token: ''
}

export default config;