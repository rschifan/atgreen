<script lang="ts">
	import {
		Content,
		Header,
		HeaderAction,
		HeaderPanelDivider,
		HeaderPanelLink,
		HeaderPanelLinks,
		HeaderUtilities,
		SkipToContent
	} from 'carbon-components-svelte';
	import { TooltipDefinition } from 'carbon-components-svelte';
	import { Column, Grid, Row } from 'carbon-components-svelte';
	import { expoIn } from 'svelte/easing';

	let isSideNavOpen = false;
	let isOpen = false;
	let selected = '0';
	let transitions = {
		'0': {
			text: 'Default (duration: 200ms)',
			value: { duration: 200 }
		},
		'1': {
			text: 'Custom (duration: 600ms, delay: 50ms, easing: expoIn)',
			value: { duration: 600, delay: 50, easing: expoIn }
		},
		'2': {
			text: 'Disabled',
			value: false
		}
	};

	let ref;
	let active;
	let content_height;
</script>

<svelte:window bind:innerHeight={content_height} />

<Header persistentHamburgerMenu={false} company="ATGreen" bind:isSideNavOpen>
	<svelte:fragment slot="skip-to-content">
		<SkipToContent />
	</svelte:fragment>

	<HeaderUtilities>
		<HeaderAction bind:isOpen transition={transitions[selected].value}>
			<HeaderPanelLinks>
				<HeaderPanelLink href="/">Home</HeaderPanelLink>

				<HeaderPanelDivider>AtGreen Project</HeaderPanelDivider>
				<HeaderPanelLink href="about">About</HeaderPanelLink>
				<HeaderPanelLink href="mailto:rossano.schifanella@unito.it">Contact us</HeaderPanelLink>
			</HeaderPanelLinks>
		</HeaderAction>
	</HeaderUtilities>
</Header>

<Content>
	<Grid noGutter>
		<Row>
			<Column noGutter class="mobile-padding">
				<!-- <h3>Project</h3> -->

				<span class="focus-text">
					<span class="bold-text">ATGreen</span> is an interactive web platform
					<span class="bold-text">to explore accessibility to green</span>
					in over <span class="bold-text">1,000 cities</span> and
					<span class="bold-text">145 countries</span> worldwide.
				</span>

				<h3>What is ATGreen useful for?</h3>

				<p>
					This interactive web platform has the goal to provide a user-friendly interface to study
					the multi-dimensional concept of accessibility to public green areas making all the data
					and algorithms easily accessible to the wide audience and to policymakers.
				</p>
				<p>
					The functionalities of the platform go well beyond those of a simple data exploration
					tool, by allowing the user to build her own indicators and test the impact of selected
					urban green interventions. The use of open source data and open source software for the
					development of the framework and of the interface make it extendable to any other city –
					subject to an evaluation of the quality of the underlying data.
				</p>
				<p>ATGreen provides the following main sections:</p>

				<div style="margin-left: 1rem;">
					<h4>Measure</h4>

					<p>
						Understand how different areas of your city perform in terms of green accessibility. To
						help you through this journey, we have operationalized and computed a set of indexes
						proposed by institutional bodies around the world.
					</p>

					<p>
						Each index is linked to a specific target: in the map, areas satisfying the target will
						be displayed in green, areas that are missing out are displayed in red.
					</p>

					<p>
						Do you want to get a better grasp of how the index is computed? Click on the area of
						interest and see which green features in your city concur to the value of the index.
					</p>

					<h4>Compare</h4>
					<p>
						Select any two indexes and compare the performance of the various areas of your city
						based on each of the two to investigate if all the green accessibility indexes tell the
						same story.
					</p>
					<h4>Create</h4>
					<p>
						Not happy with the green accessibility indexes proposed by the selected institutional
						bodies? Create your own by chooseing the class of index you are interested in, setting
						your parameters and defining your target.
					</p>
					<p>
						If your city is very big, please be patient: this functionality can take up to a couple
						of minutes to run.
					</p>

					<h4>Draw (under development)</h4>
					<p>
						Do you want to see the impact that adding a new green spot would have of the level of
						green accessibility in your city? Tell us where the new green spot should be located,
						the class of index you are interested in and see how the degree of accessibility would
						change with this new piece of green infrastructure!
					</p>

					<h4>Explore</h4>
					<p>
						Navigate the urban space of your city and look at its green infrastructure! Remember to
						play with the type of green and the size to get a better grasp of the characteristics of
						the provision of urban green in your city.
					</p>
				</div>

				<h3>Why is green accessibility important?</h3>
				<p>
					In recent years, greenifying initiatives such as Nature-Based Solutions or the planning of
					new urban parks have started to frequently appear in the political agenda of cities
					worldwide, and are welcomed as effective measures to alleviate extreme climate conditions
					as well as to mitigate the environmental footprint of cities.
				</p>
				<p>
					Indeed, vast academic literature has shown that improving the green infrastructure in a
					city can effectively tackle pressing environmental challenges, providing biodiversity
					support and carbon storage but also acting as soil protectors and temperature regulators.
				</p>
				<p>
					However, the benefits of urban greenery go beyond the environmental domain, and extend to
					the well-being of urban residents, by improving their health outcomes and increasing
					social cohesion. To ensure these benefits are fully realised, it is important to move away
					from city-average metrics and switch towards the use of several families of green
					accessibility indicators, that are able capture the interplay between the population
					distribution and the spatial distribution of the green infrastructure.
				</p>
				<p>
					ATGREEN is an interactive web platform that allows you to measure several families of
					green accessibility indicators, to to fully characterise the nature-citizen experience in
					urban environments.
				</p>

				<h3>How do we measure accessibility to green areas?</h3>

				<p>
					This platform is the result of the cleaning, processing and merging of information from a
					series of public data sources.
				</p>

				<ul>
					<li class="how">
						<span>City boundary</span>
						<p>
							Cities were defined according to the boundaries in the

							<a
								href="https://ghsl.jrc.ec.europa.eu/ghs_stat_ucdb2015mt_r2019a.php#:~:text=The%20GHS%20Urban%20Centre%20Database,in%20the%20open%20scientific%20domain."
								>Urban Centre Database of the Global Human Settlement 2015, revised version R2019A
								(GHS-UCDB)</a
							>. Out of 13,000 urban centers recorded in the database, we retained the most
							populated 50 UCs per country, provided that they had at least 100,000 inhabitants. We
							further excluded cities whose quality for which the quality of the OpenStreetMap (OSM)
							data was deemed insufficient according to the procedure described the manuscript. The
							final sample comprised 1,040 UCs across 145 countries.
						</p>
					</li>
					<li class="how">
						<span>Population data </span>
						<p>
							Population data were extracted from the population grid of the <a
								href="https://ghsl.jrc.ec.europa.eu/ghs_pop.php"
								>Global Human Settlement 2015 (revised version 2019A)</a
							> at a 9-arcseconds resolution. The data consist of residential population estimates for
							the year 2015, disaggregated from census or administrative units to grid cells and informed
							by the distribution and density of built-up as mapped in the corresponding Global Human
							Settlement Layer (GHSL) global layer.
						</p>
					</li>
					<li class="how">
						<span>distance matrices</span>
						<p>
							The problem of computing the walking distances between residential areas and green
							spaces in each urban area was simplified to the computation of walking distances
							between the centroids of the base-grid, i.e. of computing a walking origin-destination
							matrix. To this scope, we locally installed the routing engine
							<a href="https://project-osrm.org/">Open Source Routing Machine (OSRM)</a> and used street-network
							data from the local OSM dumps.
						</p>
					</li>
					<li class="how">
						<span>greenspaces and other green features</span>

						<p>
							Greenspaces and other green features were extracted from two different data sources.
							For the minimum distance and per-person indexes, where we are interested in measuring
							the availability of public and accessible greenspaces, we used information from
							<a href="https://wiki.openstreetmap.org/wiki/Main_Page">OpenStreetMap</a>. For the
							exposure index, where we are interested in measuring exposure to green features,
							regardless their use, we used information form on land coverage from the World
							Coverage 2020 of the
							<a href="https://worldcover2020.esa.int/">European Space Agency</a>.
						</p>
					</li>
				</ul>

				<p>
					More information on the definition of green in both dataset and the data processing is
					provided at <span><a href="">arvix link</a></span>
				</p>

				<h3>Which accessibility indicators do we measure?</h3>

				<p>Our framework allows you to compute three classes of accessibility metrics:</p>

				<ul>
					<li class="how">
						<span>Minimum distance </span>
						<p>
							it measures the minimum walking distance from a residential location to a greenspace
							with specified characteristics in terms of the type of green (public park, grassland
							or forest, or any combination of the three) and minimum size.
						</p>
					</li>

					<li class="how">
						<span>Exposure</span>
						<p>
							it measures the total exposure to urban green from a residential location within a
							certain (walking)time budget. Compared to the minimum distance, where we only focus on
							accessible and public green, the scope of the exposure indicator is to measure the
							cumulative availability of green features around a residential location – regardelss
							of their use and degree of accessibility. This means, for example, that for this
							indicator we do not distinguish between public and private green. From the data
							viewpoint, this different perspective is mirrored in the change of the data source
							used to identify green elements (from OSM to the 2020 World Cover database of the
							European Space Agency).
						</p>
					</li>

					<li class="how">
						<span>Per-person</span>
						<p>
							it measures the per-person availability of public greenspaces of a certain size within
							a (walking)time budget around a residential location. Unlike the previous two
							indicators, which are agnostic to the population density, this index incorporates the
							notion that the use of greenspaces for specific activities is competitive. Thus, the
							level of public green that is available to a resident does not depend only on the
							total green provision but also on the cumulative number of people living within the
							service area of each greenspace.
						</p>
					</li>
				</ul>

				<h3>Team</h3>

				<p>Main contributors:</p>

				<ul>
					<li><a href="https://alibatti.github.io/">Alice Battiston</a></li>
					<li><a href="http://www.di.unito.it/~schifane/">Rossano Schifanella</a></li>
				</ul>

				<p>Collaborators:</p>

				<ul>
					<li><a href="https://www.bsc.es/reyes-patricio">Patricio Reyes</a></li>
				</ul>

				<p>The project have been developed and supported by:</p>

				<div class="logo"><a href="http://unito.it"><img src="unito.png" alt="" /></a></div>
				<div class="logo"><a href="https://isi.it/en/home"><img src="isi.png" alt="" /></a></div>
				<div class="logo"><a href="https://www.bsc.es/"><img src="bsc.png" alt="" /></a></div>
				<div class="logo"><a href="https://gogreenroutes.eu/"><img src="ggr.png" alt="" /></a></div>

				<h3>Publications</h3>
				<p>
					If you want to read more about the project and go deeper in the technical details refer to
					our new <a href="https://arxiv.org/abs/2308.05538">preprint</a> or
					<a href="mailto:rossano.schifanella@unito.it">contact us</a>.
				</p>

				<h3>Acknowledgements</h3>

				<p>
					We thank <a href="https://www.bsc.es/reyes-patricio">Dr. Patricio Reyes</a>,
					<a href="https://www.bsc.es/cucchietti-fernando">Dr. Fernando Cucchietti</a>
					and the rest of the
					<a
						href="https://www.bsc.es/es/discover-bsc/organisation/scientific-structure/scientific-visualization"
						>Data Analytics and Visualization team</a
					> at the Barcelona Supercomputing Center (BSC-CNS) for the insightful conversations and suggestions.
				</p>

				<p>
					We acknowledge partial support from the European Union’s Horizon 2020 research and
					innovation program under grant agreement No. 869764 (<a href="https://gogreenroutes.eu/"
						>GoGreenRoutes</a
					>).
				</p>

				<p>
					We acknowledge partial support from the <a
						href="https://www.bsc.es/join-us/why-to-work-at-bsc/mobility-programmes/so-mobility-grants"
						>Severo Ochoa Mobility Program</a
					> at BSC-CNS.
				</p>
			</Column></Row
		>
	</Grid>
</Content>

<style>
	@media (min-width: 480px) {
		:global(.mobile-padding) {
			padding: 0rem 2rem;
		}
	}

	span.bold-text {
		font-weight: bold;
		text-decoration: underline;
		color: rgb(208, 146, 146);
	}
	span.focus-text {
		font-size: 1.2rem;
		padding: 1rem 0rem;
		display: block;
		line-height: 1.5rem;
	}

	h3 {
		padding: 0.25rem;
		font-weight: 900;
		margin-top: 1rem;
	}

	h4 {
		padding: 0.25rem;
		font-weight: 800;
	}
	p {
		padding: 0.25rem;
		font-weight: 300;
	}

	div.logo {
		display: inline-block;
		padding: 0.5rem;
		margin-top: 1rem;
		margin-bottom: 1rem;
		background-color: white;
		height: 4rem;
		border-radius: 5px;
	}

	img {
		height: 100%;
	}

	ul {
		padding: 0rem 1rem;
	}
	li {
		padding-bottom: 0.5rem;
		padding-top: 0.5rem;
		font-weight: 800;
	}

	li.how {
		font-weight: normal;
	}

	li.how span {
		display: block;
		font-weight: bold;
		font-variant: small-caps;
		font-size: 1.25rem;
	}
</style>
