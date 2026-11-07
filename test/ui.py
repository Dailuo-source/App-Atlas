import asyncio, sys
from playwright.async_api import async_playwright
U='http://127.0.0.1:8770/'
LINK=U+'#api='+'http%3A%2F%2F127.0.0.1%3A8770%2Fapi'+'&key=k1'
out=sys.argv[1] if len(sys.argv)>1 else '/tmp/aa'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); errs=[]
    ctx=await b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,permissions=['clipboard-read','clipboard-write'])
    pg=await ctx.new_page(); pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await pg.goto(LINK); await pg.wait_for_timeout(1200)
    await pg.screenshot(path=out+'-home.png',full_page=True)
    print('needs rows',await pg.locator('section[aria-label="Needs you"] .row').count(),'apps',await pg.locator('.app').count())
    await pg.tap('.app >> nth=0'); await pg.wait_for_timeout(400)
    print('opened', await pg.inner_text('h1'))
    await pg.screenshot(path=out+'-app.png',full_page=True)
    # tick first open to-do
    t=pg.locator('.card .tick[aria-pressed=false]').first; txt=await t.get_attribute('data-text'); await t.tap(); await pg.wait_for_timeout(600)
    print('ticked',txt, 'now', await pg.locator('.card .tick[data-text="%s"]'%txt.replace('"','\\"')).count())
    # note
    await pg.fill('textarea[data-note]','Changed note'); await pg.wait_for_timeout(1300)
    # add own todo
    await pg.fill('form[data-add] input','Check the gallery link'); await pg.press('form[data-add] input','Enter'); await pg.wait_for_timeout(600)
    print('yours', await pg.locator('text=Check the gallery link').count())
    # start sheet
    await pg.tap('.startbar .gold'); await pg.wait_for_timeout(400)
    await pg.fill('#what','Add a countdown to my next class'); await pg.tap('button[data-act=copy]'); await pg.wait_for_timeout(300)
    clip=await pg.evaluate('navigator.clipboard.readText()')
    print('prompt starts:',clip[:80].replace('\n',' | '),'… has change:', 'countdown' in clip)
    await pg.screenshot(path=out+'-start.png')
    # back closes sheet, back again goes home
    await pg.go_back(); await pg.wait_for_timeout(300); print('after back 1: sheet', await pg.locator('.sheet').count(), 'h1', await pg.inner_text('h1'))
    await pg.go_back(); await pg.wait_for_timeout(300); print('after back 2: h1', await pg.inner_text('h1'))
    # reopen: draft kept
    await pg.tap('.app >> nth=0'); await pg.tap('.startbar .gold'); await pg.wait_for_timeout(300)
    print('draft kept:', await pg.input_value('#what'))
    # check now
    await pg.go_back(); await pg.go_back(); await pg.wait_for_timeout(300)
    await pg.tap('button[data-act=check]'); await pg.wait_for_timeout(4000)
    print('header:', await pg.inner_text('.hdr .sub'))
    await ctx.close()
    ctx=await b.new_context(viewport={'width':1440,'height':900}); pg=await ctx.new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
    await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await pg.goto(LINK); await pg.wait_for_timeout(1200); await pg.screenshot(path=out+'-desk.png')
    await pg.click('.app >> nth=2'); await pg.wait_for_timeout(300); await pg.screenshot(path=out+'-desk2.png')
    print('desk main h1:', await pg.inner_text('main h1'), '| main width', await pg.evaluate("document.querySelector('main').getBoundingClientRect().width"))
    print('errors:',errs)
    await b.close()
asyncio.run(main())
