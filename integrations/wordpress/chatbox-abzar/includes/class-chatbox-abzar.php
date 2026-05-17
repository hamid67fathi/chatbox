<?php
/**
 * ChatBox WordPress widget (ابزارک) integration.
 *
 * @package ChatboxAbzar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Main plugin class.
 */
final class Chatbox_Abzar {

	const OPTION_API_URL        = 'chatbox_abzar_api_url';
	const OPTION_WORKSPACE_SLUG = 'chatbox_abzar_workspace_slug';
	const OPTION_ENABLED        = 'chatbox_abzar_enabled';

	/**
	 * @var self|null
	 */
	private static $instance = null;

	/**
	 * @return self
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Activation defaults.
	 */
	public static function activate() {
		if ( false === get_option( self::OPTION_ENABLED ) ) {
			add_option( self::OPTION_ENABLED, '1' );
		}
	}

	private function __construct() {
		add_action( 'admin_menu', array( $this, 'register_settings_page' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_widget' ) );
		add_filter( 'script_loader_tag', array( $this, 'widget_script_attributes' ), 10, 3 );
	}

	/**
	 * @return bool
	 */
	private function is_enabled() {
		return '1' === get_option( self::OPTION_ENABLED, '1' );
	}

	/**
	 * @return string
	 */
	private function api_url() {
		return trim( (string) get_option( self::OPTION_API_URL, '' ) );
	}

	/**
	 * @return string
	 */
	private function workspace_slug() {
		return trim( (string) get_option( self::OPTION_WORKSPACE_SLUG, '' ) );
	}

	/**
	 * Admin menu.
	 */
	public function register_settings_page() {
		add_options_page(
			__( 'ابزارک ChatBox', 'chatbox-abzar' ),
			__( 'ابزارک ChatBox', 'chatbox-abzar' ),
			'manage_options',
			'chatbox-abzar',
			array( $this, 'render_settings_page' )
		);
	}

	/**
	 * Register options.
	 */
	public function register_settings() {
		register_setting(
			'chatbox_abzar',
			self::OPTION_API_URL,
			array(
				'type'              => 'string',
				'sanitize_callback' => array( $this, 'sanitize_api_url' ),
				'default'           => '',
			)
		);
		register_setting(
			'chatbox_abzar',
			self::OPTION_WORKSPACE_SLUG,
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_title',
				'default'           => '',
			)
		);
		register_setting(
			'chatbox_abzar',
			self::OPTION_ENABLED,
			array(
				'type'              => 'string',
				'sanitize_callback' => array( $this, 'sanitize_enabled' ),
				'default'           => '1',
			)
		);

		add_settings_section(
			'chatbox_abzar_main',
			__( 'تنظیمات ابزارک', 'chatbox-abzar' ),
			array( $this, 'render_section_intro' ),
			'chatbox-abzar'
		);

		add_settings_field(
			self::OPTION_ENABLED,
			__( 'فعال‌سازی', 'chatbox-abzar' ),
			array( $this, 'render_enabled_field' ),
			'chatbox-abzar',
			'chatbox_abzar_main'
		);
		add_settings_field(
			self::OPTION_API_URL,
			__( 'آدرس API', 'chatbox-abzar' ),
			array( $this, 'render_api_url_field' ),
			'chatbox-abzar',
			'chatbox_abzar_main'
		);
		add_settings_field(
			self::OPTION_WORKSPACE_SLUG,
			__( 'Workspace Slug', 'chatbox-abzar' ),
			array( $this, 'render_workspace_slug_field' ),
			'chatbox-abzar',
			'chatbox_abzar_main'
		);
	}

	/**
	 * @param string $value Raw URL.
	 * @return string
	 */
	public function sanitize_api_url( $value ) {
		$value = trim( (string) $value );
		if ( '' === $value ) {
			return '';
		}
		$value = esc_url_raw( $value );
		return untrailingslashit( $value );
	}

	/**
	 * @param mixed $value Checkbox value.
	 * @return string
	 */
	public function sanitize_enabled( $value ) {
		return ! empty( $value ) ? '1' : '0';
	}

	public function render_section_intro() {
		echo '<p>';
		esc_html_e(
			'مقادیر را از پنل ChatBox → تنظیمات → ویجت (بخش نصب ابزارک) کپی کنید.',
			'chatbox-abzar'
		);
		echo '</p>';
	}

	public function render_enabled_field() {
		$enabled = $this->is_enabled();
		printf(
			'<label><input type="checkbox" name="%1$s" value="1" %2$s /> %3$s</label>',
			esc_attr( self::OPTION_ENABLED ),
			checked( $enabled, true, false ),
			esc_html__( 'نمایش ابزارک چت در سایت', 'chatbox-abzar' )
		);
	}

	public function render_api_url_field() {
		printf(
			'<input type="url" name="%1$s" value="%2$s" class="regular-text" dir="ltr" placeholder="https://api.example.com" />',
			esc_attr( self::OPTION_API_URL ),
			esc_attr( $this->api_url() )
		);
	}

	public function render_workspace_slug_field() {
		printf(
			'<input type="text" name="%1$s" value="%2$s" class="regular-text" dir="ltr" placeholder="my-workspace" />',
			esc_attr( self::OPTION_WORKSPACE_SLUG ),
			esc_attr( $this->workspace_slug() )
		);
	}

	public function render_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		?>
		<div class="wrap">
			<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
			<form action="options.php" method="post">
				<?php
				settings_fields( 'chatbox_abzar' );
				do_settings_sections( 'chatbox-abzar' );
				submit_button( __( 'ذخیره تنظیمات', 'chatbox-abzar' ) );
				?>
			</form>
			<hr />
			<h2><?php esc_html_e( 'راهنمای نصب', 'chatbox-abzar' ); ?></h2>
			<ol>
				<li><?php esc_html_e( 'در پنل ChatBox، Workspace Slug و آدرس API را از تنظیمات ویجت بردارید.', 'chatbox-abzar' ); ?></li>
				<li><?php esc_html_e( 'مقادیر را در فرم بالا وارد و ذخیره کنید.', 'chatbox-abzar' ); ?></li>
				<li><?php esc_html_e( 'ابزارک در تمام صفحات عمومی سایت نمایش داده می‌شود.', 'chatbox-abzar' ); ?></li>
			</ol>
		</div>
		<?php
	}

	/**
	 * Enqueue widget bundle from ChatBox API host.
	 */
	public function enqueue_widget() {
		if ( is_admin() || ! $this->is_enabled() ) {
			return;
		}

		$api_url = $this->api_url();
		$slug    = $this->workspace_slug();

		if ( '' === $api_url || '' === $slug ) {
			return;
		}

		$script_url = $api_url . '/widget-demo/dist/index.global.js';

		wp_enqueue_script(
			'chatbox-abzar-widget',
			$script_url,
			array(),
			CHATBOX_ABZAR_VERSION,
			true
		);
	}

	/**
	 * Add data attributes required by the widget loader.
	 *
	 * @param string $tag    Script tag.
	 * @param string $handle Handle.
	 * @param string $src    Source URL.
	 * @return string
	 */
	public function widget_script_attributes( $tag, $handle, $src ) {
		if ( 'chatbox-abzar-widget' !== $handle ) {
			return $tag;
		}

		$api_url = esc_attr( $this->api_url() );
		$slug    = esc_attr( $this->workspace_slug() );

		return sprintf(
			'<script src="%1$s" id="%2$s-js" data-api-url="%3$s" data-workspace-slug="%4$s" async></script>' . "\n",
			esc_url( $src ),
			esc_attr( $handle ),
			$api_url,
			$slug
		);
	}
}
