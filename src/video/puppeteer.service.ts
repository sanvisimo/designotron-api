import { Injectable, StreamableFile } from '@nestjs/common';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import { spawn } from 'child_process';

@Injectable()
export class PuppeteerService {
  async exportVideo(opts) {
    const {
      output = '/tmp/puppeteer/videoPupp.mp4',
      type = 'png',
      animationData,
      path: animationPath = undefined,
      jpegQuality = 90,
      quiet = false,
      deviceScaleFactor = 1,
      renderer = 'svg',
      rendererSettings = {},
      style = {},
      inject = {},
      puppeteerOptions = {},
      ffmpegOptions = {
        crf: 20,
        profileVideo: 'main',
        preset: 'medium',
      },
      gifskiOptions = {
        quality: 80,
        fast: false,
      },
      progress = undefined,
      frameNumber = 70,
    } = opts;

    const start = new Date().getTime();
    console.log('inizio');

    const browser = await puppeteer.launch({
      headless: 'shell',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...puppeteerOptions,
    });

    const genBrowser = new Date().getTime();
    console.log('genero il browser', (genBrowser - start) / 1000);

    let { width = undefined, height = undefined } = opts;

    const lottieData = animationData;
    const fps = ~~lottieData.fr;
    const { w = 640, h = 480 } = lottieData;
    const aR = w / h;

    console.log('fps', fps, animationData.fr);

    if (!(width && height)) {
      if (width) {
        height = width / aR;
      } else if (height) {
        width = height * aR;
      } else {
        width = w;
        height = h;
      }
    }

    width = width | 0;
    height = height | 0;

    const lottieScript = fs.readFileSync(
      require.resolve('lottie-web/build/player/lottie.min'),
      'utf8',
    );
    const injectLottie = `
<script>
  ${lottieScript}
</script>
`;

    const animation = null;

    const html = `
<html>
<head>
  <meta charset="UTF-8">

  ${inject.head || ''}
 ${injectLottie}

  <style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

@font-face {
 font-family: "Field Gothic";
  src:
    local("Field Gothic No. 46");
}

body {
  background: transparent;

  ${width ? 'width: ' + width + 'px;' : ''}
  ${height ? 'height: ' + height + 'px;' : ''}

  overflow: hidden;
}


#root {
  ${style}
}

  ${inject.style || ''}
  </style>
</head>

<body>
${inject.body || ''}

<div id="root"></div>

<script>
  const animationData = ${JSON.stringify(animationData)}
  
  let duration
  let numFrames

  function onReady () {
    animation = lottie.loadAnimation({
      container: document.getElementById('root'),
      renderer: '${renderer}',
      loop: false,
      autoplay: false,
      rendererSettings: ${JSON.stringify(rendererSettings)},
      animationData
    })

    duration = animation.getDuration()
    numFrames = animation.getDuration(true)

    const div = document.createElement('div')
    div.className = 'ready'
    document.body.appendChild(div)
  }

  document.addEventListener('DOMContentLoaded', onReady)
</script>

</body>
</html>
`;

    const page = await browser.newPage();

    const openTime = new Date().getTime();
    console.log('apro il browser', (openTime - start) / 1000);

    await page.setContent(html);

    const readTime = new Date().getTime();
    console.log('leggo', (readTime - start) / 1000);

    await page.waitForSelector('.ready');

    const pageReadyTime = new Date().getTime();
    console.log('pagina pronta', (pageReadyTime - start) / 1000);

    const duration = await page.evaluate(() => duration);
    const numFrames = await page.evaluate(() => numFrames);
    console.log('numFrames', numFrames);

    const pageFrame = page.mainFrame();
    const rootHandle = await pageFrame.$('#root');

    if (type === 'png') {
      const frameTime = new Date().getTime();
      console.log('frame richiesto', frameNumber, (frameTime - start) / 1000);

      await page.evaluate(
        (frame) => animation.goToAndStop(frame, true),
        frameNumber,
      );

      const name = `test_${frameNumber}.png`;
      const tmpFile = `/tmp/puppeteer/${name}`;

      console.log('tmp', tmpFile);

      await rootHandle.screenshot({
        path: tmpFile,
        omitBackground: true,
        type: 'png',
      });

      await rootHandle.dispose();
      if (opts.browser) {
        await page.close();
      } else {
        await browser.close();
      }
      const file = fs.createReadStream(tmpFile);

      const end = new Date().getTime();
      console.log('end', (end - start) / 1000);
      return new StreamableFile(file, {
        type: 'image/png',
        disposition: `attachment; filename="${name}"`,
        // If you want to define the Content-Length value to another value instead of file's length:
        // length: 123,
      });
    } else {
      let ffmpeg;
      let ffmpegStdin;

      const ffmpegP = new Promise<void>((resolve, reject) => {
        const ffmpegArgs = ['-v', 'error', '-nostats', '-hide_banner', '-y'];

        let scale = `scale=${width}:-2`;

        if (width % 2 !== 0) {
          if (height % 2 === 0) {
            scale = `scale=-2:${height}`;
          } else {
            scale = `scale=${width + 1}:-2`;
          }
        }

        ffmpegArgs.push(
          '-f',
          'lavfi',
          '-i',
          `color=c=black:size=${width}x${720}`,
          '-f',
          'image2pipe',
          '-c:v',
          'png',
          '-r',
          `${fps}`,
          '-i',
          '-',
          '-filter_complex',
          `[0:v][1:v]overlay[o];[o]${scale}:flags=bicubic[out]`,
          '-map',
          '[out]',
          '-c:v',
          'libx264',
          '-profile:v',
          ffmpegOptions.profileVideo,
          '-preset',
          ffmpegOptions.preset,
          '-crf',
          ffmpegOptions.crf,
          // '-movflags',
          // 'faststart',
          '-pix_fmt',
          'yuv420p',
          '-r',
          `${fps}`,
        );

        ffmpegArgs.push('-frames:v', `${numFrames}`, '-an', output);

        console.log(ffmpegArgs.join(' '));

        ffmpeg = spawn(process.env.FFMPEG_PATH || 'ffmpeg', ffmpegArgs);
        const { stdin, stdout, stderr } = ffmpeg;

        if (!quiet) {
          stdout.pipe(process.stdout);
        }
        stderr.pipe(process.stderr);

        stdin.on('error', (err) => {
          if (err.code !== 'EPIPE') {
            return reject(err);
          }
        });

        ffmpeg.on('exit', async (status) => {
          if (status) {
            return reject(new Error(`FFmpeg exited with status ${status}`));
          } else {
            return resolve();
          }
        });

        ffmpegStdin = stdin;
      });

      for (let frame = 0; frame < numFrames; ++frame) {
        console.log('apro frame', frame);
        await page.evaluate(
          (frame) => animation.goToAndStop(frame, true),
          frame,
        );

        console.log('leggo');

        const screenshot = await rootHandle.screenshot({
          omitBackground: true,
          type: 'png',
        });

        if (progress) {
          progress(frame, numFrames);
        }

        // single screenshot

        if (ffmpegStdin.writable) {
          console.log('scrivo', frame);

          ffmpegStdin.write(screenshot);
        }
      }

      await rootHandle.dispose();
      if (opts.browser) {
        await page.close();
      } else {
        await browser.close();
      }

      ffmpegStdin.end();
      await ffmpegP;

      const audioAsset = animationData.assets.filter((a) =>
        'p' in a ? a.p.includes('audio') : false,
      );
      if (audioAsset[0]) {
        fs.rename(output, '/tmp/puppeteer/temp.mp4', () => {
          console.log('renamed');
        });
        const addAudio = new Promise<void>((resolve, reject) => {
          const ffmpeg = spawn(process.env.FFMPEG_PATH || 'ffmpeg', [
            '-v',
            'error',
            '-stats',
            '-hide_banner',
            '-y',
            '-i',
            '/tmp/puppeteer/temp.mp4',
            '-i',
            audioAsset[0].p,
            '-c:v',
            'copy',
            '-map',
            '0:v',
            '-map',
            '1:a',
            output,
          ]);

          const { stdout, stderr } = ffmpeg;

          if (!quiet) {
            stdout.pipe(process.stdout);
          }
          stderr.pipe(process.stderr);

          ffmpeg.on('exit', async (status) => {
            if (status) {
              return reject(new Error(`FFmpeg exited with status ${status}`));
            } else {
              return resolve();
            }
          });
        });
        await addAudio;
      }

      const file = fs.createReadStream(output);
      const end = new Date().getTime();
      console.log('end', (end - start) / 1000);
      return new StreamableFile(file, {
        type: 'video/mp4',
        disposition: `attachment; filename="videoPupp.mp4"`,
      });
    }
  }
}
