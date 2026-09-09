import {type RouteRecordRaw} from 'vue-router'
import {MainLayout} from '@'

const routes: RouteRecordRaw[] = [
	{
		path: '/:catchAll(.*)*',
		component: MainLayout,
	},
]

export default routes
