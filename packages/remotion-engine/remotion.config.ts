import { Config } from '@remotion/cli/config';

Config.setPublicDir('./eval/public');
Config.overrideWebpackConfig((currentConfiguration) => {
  return {
    ...currentConfiguration,
    resolve: {
      ...currentConfiguration.resolve,
      fallback: {
        ...currentConfiguration.resolve?.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        dotenv: false,
        pg: false,
        'pg-native': false,
        net: false,
        tls: false,
        dns: false,
        util: false,
        stream: false,
        string_decoder: false,
      },
    },
  };
});


