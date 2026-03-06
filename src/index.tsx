import { Hono } from 'hono'
import { renderer } from './renderer'

const app = new Hono()
app.use(renderer)

app.get('/', (c) => {
  return c.render(
    <div class="space-y-12 pb-24">
      {/* 1. TOP LEVEL: Breadcrumbs & Steps */}
      <section class="flex flex-col md:flex-row justify-between items-start gap-4">
        <div class="text-sm breadcrumbs">
          <ul>
            <li><a>Home</a></li> 
            <li><a>Documents</a></li> 
            <li>Add Document</li>
          </ul>
        </div>
        <ul class="steps steps-horizontal">
          <li class="step step-primary">Register</li>
          <li class="step step-primary">Plan</li>
          <li class="step">Purchase</li>
          <li class="step">Receive</li>
        </ul>
      </section>

      {/* 2. DATA GRID: Stats & Countdown */}
      <section class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div class="lg:col-span-3 stats shadow bg-base-100">
          <div class="stat">
            <div class="stat-figure text-secondary">
              <div class="avatar online">
                <div class="w-16 rounded-full">
                  <img src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp" />
                </div>
              </div>
            </div>
            <div class="stat-value">86%</div>
            <div class="stat-title">Tasks done</div>
            <div class="stat-desc text-secondary">31 tasks remaining</div>
          </div>
          
          <div class="stat">
            <div class="stat-title">Page Views</div>
            <div class="stat-value text-primary">2.6M</div>
            <div class="stat-desc">21% more than last month</div>
          </div>
        </div>

        <div class="card bg-neutral text-neutral-content shadow-xl">
          <div class="card-body items-center text-center">
            <h2 class="card-title text-sm opacity-70">Sale ends in:</h2>
            <span class="countdown font-mono text-4xl">
              <span style="--value:10;"></span>:
              <span style="--value:24;"></span>:
              <span style="--value:45;"></span>
            </span>
          </div>
        </div>
      </section>

      {/* 3. INTERACTIVE: Tabs, Accordions (Collapse), and Join */}
      <section class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div class="space-y-4">
          <h3 class="font-bold text-lg">Knowledge Base</h3>
          <div class="join join-vertical w-full bg-base-100 shadow-sm">
            <div class="collapse collapse-arrow join-item border border-base-300">
              <input type="radio" name="my-accordion-4" checked={true} /> 
              <div class="collapse-title text-xl font-medium">How to deploy?</div>
              <div class="collapse-content"><p>Use Wrangler to push to Cloudflare Pages.</p></div>
            </div>
            <div class="collapse collapse-arrow join-item border border-base-300">
              <input type="radio" name="my-accordion-4" /> 
              <div class="collapse-title text-xl font-medium">Is it free?</div>
              <div class="collapse-content"><p>Yes, for the basic tier.</p></div>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <h3 class="font-bold text-lg">System Navigation</h3>
          <div role="tablist" class="tabs tabs-lifted">
            <a role="tab" class="tab">History</a>
            <a role="tab" class="tab tab-active">Network</a>
            <a role="tab" class="tab">Security</a>
          </div>
          <div class="p-6 bg-base-100 rounded-b-box rounded-tr-box shadow-sm min-h-[150px]">
            <span class="loading loading-dots loading-lg text-primary"></span>
            <p class="mt-2 italic opacity-60">Fetching network logs...</p>
          </div>
        </div>
      </section>

      {/* 4. FEEDBACK: Modals, Ratings & Toasts (Static representation) */}
      <section class="flex flex-wrap gap-4 items-center justify-center p-10 bg-base-300 rounded-3xl">
        <button class="btn btn-secondary" onclick="my_modal_1.showModal()">Open Preview Modal</button>
        <dialog id="my_modal_1" class="modal">
          <div class="modal-box">
            <h3 class="font-bold text-lg">Confirm Action</h3>
            <p class="py-4">Are you sure you want to finalize this report?</p>
            <div class="modal-action">
              <form method="dialog">
                <button class="btn">Close</button>
                <button class="btn btn-primary">Confirm</button>
              </form>
            </div>
          </div>
        </dialog>

        <div class="rating rating-lg">
          <input type="radio" name="rating-9" class="rating-hidden" />
          <input type="radio" name="rating-9" class="mask mask-star-2 bg-orange-400" />
          <input type="radio" name="rating-9" class="mask mask-star-2 bg-orange-400" checked={true} />
          <input type="radio" name="rating-9" class="mask mask-star-2 bg-orange-400" />
          <input type="radio" name="rating-9" class="mask mask-star-2 bg-orange-400" />
          <input type="radio" name="rating-9" class="mask mask-star-2 bg-orange-400" />
        </div>

        <div class="toast toast-end relative">
          <div class="alert alert-info">
            <span>New mail arrived.</span>
          </div>
        </div>
      </section>

      {/* 5. DATA DISPLAY: Table & Swap */}
      <section class="card bg-base-100 shadow-xl overflow-hidden">
        <table class="table">
          <thead>
            <tr>
              <th>
                <label><input type="checkbox" class="checkbox" /></label>
              </th>
              <th>Project</th>
              <th>Status</th>
              <th>Favorite</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><label><input type="checkbox" class="checkbox" /></label></td>
              <td>
                <div class="flex items-center gap-3">
                  <div class="mask mask-squircle w-12 h-12 bg-primary"></div>
                  <div><div class="font-bold">Alpha Core</div><div class="text-sm opacity-50">React + Hono</div></div>
                </div>
              </td>
              <td><span class="badge badge-ghost badge-sm">Desktop App</span></td>
              <td>
                <label class="swap swap-rotate text-2xl">
                  <input type="checkbox" />
                  <div class="swap-on">❤️</div>
                  <div class="swap-off">🤍</div>
                </label>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>,
    { title: 'Mega Dashboard | All daisyUI Components' }
  )
})

export default app